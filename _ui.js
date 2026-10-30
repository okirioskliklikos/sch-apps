/*
 * Εφαρμογές σχολείου — Κοινές λειτουργίες περιβάλλοντος χρήστη
 * Έκδοση αρχείου: 0.8
 * Όνομα κατά την εγκατάσταση: _ui.js
 *
 * Φορτώνεται με <script src="_ui.js"></script> από το Κεντρικό Μενού και από κάθε υποεφαρμογή,
 * πριν από το δικό τους script. Ορίζει:
 *   window.schoolConfirm, window.schoolMessage    διάλογοι ενημέρωσης και επιβεβαίωσης
 *   window.schoolChoiceDialog                      διάλογος με επιλογές και ασύγχρονες ενέργειες
 *   window.schoolProgramImport                     κοινός διάλογος εισαγωγής προγράμματος (ανάλυση → κατασκευή)
 *   window.schoolReplaceProgram                    ερώτηση πριν αντικατασταθεί πρόγραμμα περιόδου
 *   window.schoolColorPicker, window.schoolColor   επιλογέας χρώματος και βοηθητικά χρώματος
 *   window.schoolHost                              επικοινωνία υποεφαρμογής ↔ Κεντρικού Μενού
 *   window.schoolEscape                            ασφαλές κείμενο μέσα σε HTML
 *   window.schoolIcon                              κοινά εικονίδια SVG
 *   window.schoolListSelection                     πολλαπλή επιλογή σε λίστες (κλικ, Shift, Ctrl, βέλη)
 *
 * Μέσα σε iframe (υποεφαρμογή μέσα στο Κεντρικό Μενού) επιπλέον:
 *   - στέλνει μόνο του το school-app:activity, ώστε να μη κλειδώνει η συνεδρία όσο ο χρήστης δουλεύει,
 *   - αν η σελίδα έχει την κοινή κεφαλίδα (header.page-head με .toolbar-brand), προσθέτει μπροστά από
 *     το όνομα της εφαρμογής το κουμπί «☰» (.subapp-nav-button), στέλνει school-app:menu-button,
 *     και δένει το «☰» και το όνομα (.brand-menu) με το school-app:open-menu.
 * Σε κάθε σελίδα με την κοινή κεφαλίδα κρατά στη μεταβλητή --subapp-header-height το πραγματικό
 * ύψος της κεφαλίδας (αλλάζει όταν η κεφαλίδα αναδιπλώνεται).
 * Το κείμενο μπαίνει πάντα με textContent, ποτέ ως HTML.
 * Η εμφάνιση των διαλόγων ορίζεται στο _ui.css (.school-confirm, .school-choice-*, .school-import-*,
 *   .school-color-picker)
 * και του κουμπιού «☰» στο _subapp.css.
 */
(() => {
  'use strict';
  let active = null;               // Ο διάλογος που εμφανίζεται τώρα.
  let busy = 0;                    // Διάλογοι που εμφανίζονται ή περιμένουν στην ουρά.
  let tail = Promise.resolve();    // Η ουρά των διαλόγων.
  let dialogSequence = 0;          // Μοναδικά id για τους διαλόγους επιλογής.

  function show(message, o) {
    return new Promise(resolve => {
      const previous = document.activeElement, dialog = document.createElement('dialog');
      dialog.className = 'school-confirm';
      dialog.setAttribute('aria-labelledby', 'school-confirm-title');
      dialog.setAttribute('aria-describedby', 'school-confirm-message');
      const title = document.createElement('h2'); title.id = 'school-confirm-title'; title.textContent = o.title;
      const text = document.createElement('p'); text.id = 'school-confirm-message'; text.textContent = message;
      const actions = document.createElement('div'); actions.className = 'school-confirm-actions';
      let cancel = null, accepted = false;
      if (o.confirm) {
        cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Ακύρωση';
        cancel.onclick = () => dialog.close();
        actions.append(cancel);
      }
      const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'confirm-accept';
      accept.textContent = o.confirm ? o.accept : 'Εντάξει';
      accept.onclick = () => { accepted = true; dialog.close(); };
      actions.append(accept);
      dialog.append(title, text, actions); document.body.append(dialog); active = dialog;
      dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
      dialog.addEventListener('close', () => {
        active = null; dialog.remove();
        if (previous?.isConnected) previous.focus();
        resolve(o.confirm ? accepted : true);
      }, {once: true});
      try { dialog.showModal(); (cancel || accept).focus(); }
      catch (error) { active = null; dialog.remove(); resolve(!o.confirm); }
    });
  }

  // Ενημέρωση ή επιβεβαίωση σε ουρά: ένας διάλογος τη φορά, με τη σειρά που ζητήθηκαν.
  // Επιστρέφει Promise: true όταν πατηθεί «Εντάξει» ή αποδοχή, false στην ακύρωση.
  function schoolMessage(message, options = {}) {
    const o = {title: options.title || 'Ενημέρωση', confirm: !!options.confirm, accept: options.accept || 'Συνέχεια'};
    const task = () => show(String(message ?? ''), o);
    const run = busy ? tail.then(task, task) : task();
    busy++;
    const done = () => { busy--; };
    run.then(done, done);
    tail = run.catch(() => {});
    return run;
  }

  // Επιβεβαίωση. Αν εμφανίζεται ήδη διάλογος, επιστρέφει αμέσως false (προστασία από διπλό κλικ).
  // Με options.queue = true περιμένει τη σειρά της όπως η schoolMessage.
  // Επιλογές: title, accept, queue.
  function schoolConfirm(message, options = {}) {
    if (!options.queue && busy) return Promise.resolve(false);
    return schoolMessage(message, {...options, confirm: true, title: options.title || 'Επιβεβαίωση'});
  }

  // Ακύρωση από τον χρήστη (π.χ. έκλεισε το παράθυρο επιλογής αρχείου): δεν εμφανίζεται ως λάθος.
  const isCancellation = problem => problem?.name === 'AbortError' || /ακυρώθηκε/.test(String(problem?.message || ''));

  // Διάλογος με επιλογές: τίτλος, περιεχόμενο, μεγάλα κουμπιά επιλογών (π.χ. «Τελευταίο αρχείο» /
  // «Επιλογή άλλου αρχείου») και κουμπιά ενεργειών κάτω δεξιά.
  //   options.title    τίτλος
  //   options.content  κείμενο ή στοιχείο DOM, ή πίνακας από αυτά (το κείμενο μπαίνει σε <p> με textContent)
  //   options.choices  [{label, disabled, title, value, run}]  κουμπιά επιλογής, το ένα κάτω από το άλλο
  //   options.actions  [{label, accept, disabled, value, run}] κουμπιά κάτω δεξιά (προεπιλογή: «Ακύρωση»)
  //   options.escape   false: το Esc δεν κλείνει τον διάλογο
  //   options.className  επιπλέον κλάση του διαλόγου (π.χ. για πλάτος)
  //   options.ready(controls)  καλείται μόλις ανοίξει ο διάλογος, με:
  //       controls.dialog       το στοιχείο <dialog>
  //       controls.refresh()    ξαναδιαβάζει το disabled κάθε κουμπιού (μπορεί να είναι getter)
  //       controls.busy(fn)     τρέχει το fn() με τα κουμπιά ανενεργά· ένα λάθος εμφανίζεται στον διάλογο
  //       controls.working      true όσο τρέχει μια ενέργεια
  // Ένα κουμπί χωρίς run κλείνει τον διάλογο με την τιμή value (ή null). Με run, τα κουμπιά
  // απενεργοποιούνται όσο τρέχει· αν πετύχει, ο διάλογος κλείνει με την τιμή που επέστρεψε,
  // αλλιώς το μήνυμα λάθους εμφανίζεται μέσα στον διάλογο και ο χρήστης ξαναδοκιμάζει.
  // Επιστρέφει Promise με την τιμή, ή null στο Esc.
  function schoolChoiceDialog(options = {}) {
    return new Promise(resolve => {
      const previous = document.activeElement, dialog = document.createElement('dialog');
      const id = 'school-choice-' + (++dialogSequence);
      dialog.className = 'school-confirm school-choice' + (options.className ? ' ' + options.className : '');
      dialog.setAttribute('aria-labelledby', id + '-title');
      const title = document.createElement('h2'); title.id = id + '-title'; title.textContent = options.title || 'Επιλογή';
      const content = [];
      for (const item of [].concat(options.content ?? [])) {
        if (item == null) continue;
        if (typeof item === 'string') { const p = document.createElement('p'); p.textContent = item; content.push(p); }
        else content.push(item);
      }
      if (content[0]?.tagName === 'P') { content[0].id ||= id + '-text'; dialog.setAttribute('aria-describedby', content[0].id); }
      const error = document.createElement('p'); error.className = 'school-choice-error'; error.setAttribute('role', 'alert');
      const buttons = [];
      let working = false, value = null;
      const refresh = () => { for (const [button, spec] of buttons) button.disabled = working || !!spec.disabled; };
      const setWorking = on => { working = on; dialog.toggleAttribute('aria-busy', on); refresh(); options.working?.(on); };
      const finish = result => { value = result === undefined ? null : result; dialog.close(); };
      const activate = async spec => {
        if (working) return;
        if (!spec.run) { finish(spec.value); return; }
        error.textContent = ''; setWorking(true);
        try { const result = await spec.run(); setWorking(false); finish(result); }
        catch (problem) { setWorking(false); if (!isCancellation(problem)) error.textContent = problem?.message || String(problem); }
      };
      const button = spec => {
        const element = document.createElement('button'); element.type = 'button'; element.textContent = spec.label;
        if (spec.accept) element.className = 'confirm-accept';
        if (spec.title) element.title = spec.title;
        element.disabled = !!spec.disabled; element.onclick = () => activate(spec);
        buttons.push([element, spec]); return element;
      };
      dialog.append(title, ...content);
      let choices = null;
      if (options.choices?.length) {
        choices = document.createElement('div'); choices.className = 'school-choice-options';
        choices.append(...options.choices.map(button)); dialog.append(choices);
      }
      const actions = document.createElement('div'); actions.className = 'school-confirm-actions';
      actions.append(...(options.actions || [{label: 'Ακύρωση'}]).map(button));
      dialog.append(error, actions);
      // Κάθε αλλαγή σε πεδίο του διαλόγου σβήνει το προηγούμενο μήνυμα λάθους.
      dialog.addEventListener('change', () => { error.textContent = ''; });
      dialog.addEventListener('cancel', event => { event.preventDefault(); if (!working && options.escape !== false) finish(null); });
      dialog.addEventListener('close', () => {
        dialog.remove();
        if (previous?.isConnected) previous.focus();
        resolve(value);
      }, {once: true});
      document.body.append(dialog);
      try {
        dialog.showModal();
        const enabled = list => list && [...list.querySelectorAll('button')].find(item => !item.disabled);
        (enabled(choices) || actions.querySelector('.confirm-accept:not(:disabled)') || enabled(actions))?.focus();
      } catch { dialog.remove(); resolve(null); return; }
      options.ready?.({
        dialog, refresh,
        get working() { return working; },
        async busy(task) {
          if (working) return undefined;
          error.textContent = ''; setWorking(true);
          try { return await task(); }
          catch (problem) { if (!isCancellation(problem)) error.textContent = problem?.message || String(problem); return undefined; }
          finally { if (dialog.open) setWorking(false); }
        }
      });
    });
  }

  // Κοινός διάλογος εισαγωγής προγράμματος, πάνω στο schoolChoiceDialog. Διαβάζει τα αρχεία, δείχνει την
  // ανάλυση (λάθη, προειδοποιήσεις, ενημερωτικά, σύνοψη), ρωτά για τους εκπαιδευτικούς χωρίς αντιστοίχιση
  // και καλεί την κατασκευή. Τη διαδικασία (ανάλυση, κατασκευή) τη δίνει η εφαρμογή, συνήθως από το _data.js.
  //   options.title, options.intro      τίτλος και εισαγωγικό κείμενο (κείμενο ή στοιχείο DOM)
  //   options.files   [{key, label, last, read, choose}]
  //                   last: όνομα του τελευταίου αρχείου (ή κενό)· read(): Promise με {name, text} του
  //                   τελευταίου αρχείου (ή null)· choose(): Promise με {name, text} νέου αρχείου.
  //                   Τα τελευταία αρχεία διαβάζονται μόλις ανοίξει ο διάλογος.
  //   options.analyze(loaded)            loaded: {key: {name, text}} → ανάλυση {ok, errors, warnings, info,
  //                                      unmatchedTeachers, summary:[{value, label}]} (ή Promise)
  //   options.build(analysis, {unmatched:'keep'|'drop', direct})  → η τιμή του διαλόγου (π.χ. το πρόγραμμα)·
  //                                      direct: true όταν η εισαγωγή έγινε χωρίς διάλογο (options.direct)
  //   options.accept                     ετικέτα του κουμπιού αποδοχής (προεπιλογή «Εισαγωγή»)
  //   options.direct                     «από τρέχοντα αρχεία»: διαβάζει τα τελευταία αρχεία και κάνει την ανάλυση
  //                                      πριν από τον διάλογο. Αν όλα διαβάστηκαν και η ανάλυση δεν έχει λάθη,
  //                                      προειδοποιήσεις ή εκπαιδευτικούς χωρίς αντιστοίχιση, καλεί αμέσως το
  //                                      build, χωρίς διάλογο. Αλλιώς ανοίγει ο διάλογος με τα αποτελέσματα.
  // Επιστρέφει Promise με την τιμή του build, ή null στην ακύρωση. Με λάθη στην ανάλυση η αποδοχή μένει ανενεργή.
  async function schoolProgramImport(options = {}) {
    const files = options.files || [], preset = {loaded: {}, rowErrors: {}, analysis: null, analysisError: ''};
    if (options.direct) {
      for (const file of files) {
        if (!file.last) continue;
        try { const value = await file.read(); if (value) preset.loaded[file.key] = value; }
        catch (problem) { if (!isCancellation(problem)) preset.rowErrors[file.key] = problem?.message || String(problem); }
      }
      if (files.every(file => preset.loaded[file.key])) {
        try {
          const result = await options.analyze(preset.loaded);
          preset.analysis = result;
          if (result?.ok && !result.errors?.length && !result.warnings?.length && !result.unmatchedTeachers?.length) {
            return await options.build(result, {unmatched: 'keep', direct: true});
          }
        } catch (problem) { preset.analysis = null; preset.analysisError = problem?.message || String(problem); }
      }
    }
    return importDialog(options, preset);
  }
  function importDialog(options, preset) {
    const files = options.files || [], loaded = preset.loaded, rowErrors = preset.rowErrors;
    let analysis = preset.analysis, analysisError = preset.analysisError, controls = null, rowButtons = [];
    const element = (tag, className, textValue) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (textValue != null) node.textContent = textValue;
      return node;
    };
    const list = element('div', 'school-import-files');
    const result = element('div', 'school-import-result');
    result.setAttribute('aria-live', 'polite');
    const unmatchedBox = element('fieldset', 'subapp-import-mode');
    unmatchedBox.append(element('legend', '', 'Εκπαιδευτικοί χωρίς αντιστοίχιση'));
    for (const [value, label] of [['keep', 'Εισαγωγή χωρίς αντιστοίχιση (κρατιέται το όνομα του αρχείου)'], ['drop', 'Να μην εισαχθούν (οι δραστηριότητές τους μένουν χωρίς αυτούς)']]) {
      const row = element('label'), input = element('input');
      input.type = 'radio'; input.name = 'school-import-unmatched'; input.value = value; input.checked = value === 'keep';
      row.append(input, ' ' + label); unmatchedBox.append(row);
    }
    const renderFiles = () => {
      rowButtons = [];
      list.replaceChildren(...files.map(file => {
        const row = element('div', 'school-import-file'), textBox = element('div', 'school-import-file-text');
        const current = loaded[file.key]?.name || file.last || '';
        textBox.append(element('span', 'school-import-file-label', file.label),
          element('span', 'school-import-file-name', loaded[file.key] ? current : current ? 'Τελευταίο αρχείο: ' + current : 'Δεν έχει επιλεγεί αρχείο'));
        if (rowErrors[file.key]) textBox.append(element('span', 'school-import-file-error', rowErrors[file.key]));
        const button = element('button', '', current ? 'Επιλογή άλλου…' : 'Επιλογή…');
        button.type = 'button'; button.disabled = !!controls?.working;
        button.onclick = () => controls?.busy(async () => {
          const chosen = await file.choose();
          if (!chosen) return;
          loaded[file.key] = chosen; delete rowErrors[file.key];
          renderFiles(); await analyzeNow();
        });
        rowButtons.push(button); row.append(textBox, button); return row;
      }));
    };
    const section = (className, title, items) => {
      if (!items?.length) return null;
      const box = element('section', 'school-import-section ' + className), ul = element('ul');
      box.append(element('h3', '', title));
      ul.append(...items.map(item => element('li', '', item)));
      box.append(ul); return box;
    };
    const renderResult = () => {
      const parts = [];
      if (analysisError) parts.push(section('error', 'Λάθος', [analysisError]));
      else if (!analysis) parts.push(element('p', 'school-import-waiting', files.every(file => loaded[file.key]) ? '' : 'Επίλεξε τα αρχεία για να γίνει ο έλεγχος.'));
      else {
        if (analysis.ok && analysis.summary?.length) {
          const summary = element('div', 'school-import-summary');
          for (const item of analysis.summary) { const cell = element('div'); cell.append(element('b', '', String(item.value)), element('span', '', item.label)); summary.append(cell); }
          parts.push(summary);
        }
        parts.push(section('error', 'Η εισαγωγή δεν μπορεί να γίνει', analysis.errors));
        parts.push(section('warning', 'Προειδοποιήσεις', analysis.warnings));
        parts.push(section('info', 'Ενημερωτικά', analysis.info));
        if (analysis.ok && analysis.unmatchedTeachers?.length) parts.push(unmatchedBox);
      }
      result.replaceChildren(...parts.filter(Boolean));
      controls?.refresh();
    };
    const analyzeNow = async () => {
      analysis = null; analysisError = '';
      if (files.every(file => loaded[file.key])) {
        try { analysis = await options.analyze(loaded); }
        catch (problem) { analysisError = problem?.message || String(problem); }
      }
      renderResult();
    };
    renderFiles(); renderResult();
    return schoolChoiceDialog({
      title: options.title || 'Εισαγωγή προγράμματος',
      className: 'school-import',
      content: [options.intro, list, result],
      actions: [
        {label: 'Ακύρωση'},
        {label: options.accept || 'Εισαγωγή', accept: true, get disabled() { return !analysis?.ok; },
          run: async () => options.build(analysis, {unmatched: unmatchedBox.querySelector('input:checked')?.value === 'drop' ? 'drop' : 'keep', direct: false})}
      ],
      working: on => { for (const button of rowButtons) button.disabled = on; },
      ready: async api => {
        controls = api; api.refresh();
        await api.busy(async () => {
          // Files already read (options.direct) are not read again, nor analysed again.
          let read = false;
          for (const file of files) {
            if (!file.last || loaded[file.key] || rowErrors[file.key]) continue;
            read = true;
            try { const value = await file.read(); if (value) loaded[file.key] = value; }
            catch (problem) { if (!isCancellation(problem)) rowErrors[file.key] = problem?.message || String(problem); }
          }
          renderFiles();
          if (read || (!analysis && !analysisError)) await analyzeNow(); else renderResult();
        });
      }
    });
  }

  // Ερώτηση πριν αντικατασταθεί ένα πρόγραμμα περιόδου (εισαγωγή, ανάθεση προσχεδίου, αντιγραφή).
  //   options.title, options.message   τίτλος και κείμενο
  //   options.suggestedName           προτεινόμενο όνομα του προσχεδίου
  // → Promise με {mode:'draft', name} («Κράτησέ το ως προσχέδιο»), {mode:'replace'} («Πλήρης
  //   αντικατάσταση») ή null (ακύρωση).
  function schoolReplaceProgram(options = {}) {
    const field = document.createElement('label'), input = document.createElement('input');
    field.className = 'school-choice-field';
    field.textContent = 'Όνομα προσχεδίου (αν το κρατήσεις)';
    input.type = 'text'; input.maxLength = 300; input.value = options.suggestedName || '';
    field.append(input);
    return schoolChoiceDialog({
      title: options.title || 'Αντικατάσταση προγράμματος',
      content: [options.message || 'Η περίοδος έχει ήδη πρόγραμμα αυτού του είδους. Τι να γίνει με αυτό;', field],
      choices: [
        {label: 'Κράτησέ το ως προσχέδιο', run: () => {
          const name = input.value.trim();
          if (!name) { input.focus(); throw Error('Συμπλήρωσε όνομα για το προσχέδιο.'); }
          return {mode: 'draft', name};
        }},
        {label: 'Πλήρης αντικατάσταση', value: {mode: 'replace'}}
      ]
    });
  }

  // Επιλογέας χρώματος: σταθερή παλέτα και έως 8 προσαρμοσμένα χρώματα, που ο browser θυμάται.
  // Επιστρέφει Promise με το χρώμα (#rrggbb) στην «Επιλογή», ή null στο «Άκυρο»/Esc.
  // Επιλογές: title, accept.
  const palette = [
    '#a8d8ff','#8be8a8','#fff36b','#ffc16d','#ff6254','#d07ed4','#c5a185','#ffffff','#808085',
    '#5d9be5','#4fd87a','#ffe55f','#ffa548','#ef2f3e','#b962c6','#b4865e','#f5f5f5','#5e5e65',
    '#3387de','#32c96b','#ffda31','#ff7c00','#e6192b','#903eb6','#96683e','#dddddd','#3f3a4a',
    '#1f73cc','#2db864','#f0b100','#c84e00','#b31332','#71378e','#60442c','#aaaaaa','#000000'
  ];
  const customKey = 'school-ui:custom-colors';
  const customDefaults = ['#f27e00','#2f68b6','#fff1a8','#add7f4','#fac9c9','#f5bfc0','#dfa0a2','#dc9698'];
  const validColor = value => /^#[0-9a-f]{6}$/.test(String(value ?? '').trim().toLowerCase());
  const normalColor = (value, fallback = '#a8d8ff') => validColor(value) ? String(value).trim().toLowerCase() : fallback;
  // Χρώμα γραμμάτων που διαβάζεται πάνω στο δοσμένο φόντο: λευκό σε σκούρο, σχεδόν μαύρο σε ανοιχτό.
  const inkFor = color => {
    const hex = normalColor(color).slice(1);
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 135 ? '#ffffff' : '#111111';
  };
  let customColors = null;
  function loadCustomColors() {
    if (customColors) return customColors;
    try {
      const saved = JSON.parse(localStorage.getItem(customKey) || 'null');
      customColors = Array.isArray(saved) ? saved.filter(validColor).map(c => normalColor(c)).slice(0, 8) : null;
    } catch { customColors = null; }
    if (!customColors) customColors = [...customDefaults];
    return customColors;
  }
  function saveCustomColors() {
    try { localStorage.setItem(customKey, JSON.stringify(customColors)); } catch {}
  }

  function schoolColorPicker(color, options = {}) {
    return new Promise(resolve => {
      const previous = document.activeElement, dialog = document.createElement('dialog');
      dialog.className = 'school-color-picker';
      dialog.setAttribute('aria-labelledby', 'school-color-picker-title');
      let selected = normalColor(color);
      const custom = loadCustomColors();
      if (!palette.includes(selected) && !custom.includes(selected)) { custom.unshift(selected); custom.splice(8); }

      const header = document.createElement('div'); header.className = 'school-color-picker-header';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Άκυρο';
      const title = document.createElement('div'); title.id = 'school-color-picker-title';
      title.className = 'school-color-picker-title'; title.textContent = options.title || 'Επιλογή χρώματος';
      const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'confirm-accept';
      accept.textContent = options.accept || 'Επιλογή';
      header.append(cancel, title, accept);
      const grid = document.createElement('div'); grid.className = 'school-color-picker-grid';
      const customTitle = document.createElement('div'); customTitle.className = 'school-color-picker-custom-title';
      customTitle.textContent = 'Προσαρμογή';
      const customRow = document.createElement('div'); customRow.className = 'school-color-picker-custom-row';
      const add = document.createElement('button'); add.type = 'button'; add.className = 'school-color-picker-add';
      add.textContent = '＋'; add.setAttribute('aria-label', 'Προσθήκη προσαρμοσμένου χρώματος');
      const customList = document.createElement('div'); customList.className = 'school-color-picker-custom';
      customRow.append(add, customList);
      // The native input lives inside the dialog, so it is not inert while the dialog is modal.
      const native = document.createElement('input'); native.type = 'color'; native.tabIndex = -1;
      native.className = 'school-color-picker-native'; native.setAttribute('aria-hidden', 'true');

      const choice = value => {
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'school-color-picker-choice' + (value === selected ? ' selected' : '');
        button.style.setProperty('--choice-color', value);
        button.style.setProperty('--choice-ink', inkFor(value));
        button.setAttribute('aria-label', 'Χρώμα ' + value);
        button.setAttribute('aria-pressed', String(value === selected));
        button.onclick = () => { selected = value; render(); };
        return button;
      };
      const render = () => {
        grid.replaceChildren(...palette.map(choice));
        customList.replaceChildren(...custom.map(choice));
      };
      let done = false;
      add.onclick = () => { native.value = selected; native.click(); };
      native.oninput = () => {
        selected = normalColor(native.value, selected);
        const index = custom.indexOf(selected); if (index !== -1) custom.splice(index, 1);
        custom.unshift(selected); custom.splice(8); saveCustomColors(); render();
      };
      cancel.onclick = () => dialog.close();
      accept.onclick = () => { done = true; dialog.close(); };
      dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
      dialog.addEventListener('close', () => {
        dialog.remove();
        if (previous?.isConnected) previous.focus();
        resolve(done ? selected : null);
      }, {once: true});
      dialog.append(header, grid, customTitle, customRow, native);
      document.body.append(dialog); render();
      try { dialog.showModal(); (grid.querySelector('.selected') || customList.querySelector('.selected') || accept).focus(); }
      catch { dialog.remove(); resolve(null); }
    });
  }

  // Ασφαλές κείμενο μέσα σε HTML (τιμές ιδιοτήτων και περιεχόμενο): για κείμενο που δεν είναι HTML.
  const escapes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  function schoolEscape(value) { return String(value ?? '').replace(/[&<>"']/g, c => escapes[c]); }

  // Κοινά εικονίδια (24×24, χρώμα από το currentColor). Το μέγεθος το δίνει το CSS του κουμπιού.
  // schoolIcon(name) επιστρέφει το SVG ως κείμενο· ένα στοιχείο με data-school-icon="name" και χωρίς
  // περιεχόμενο στη σελίδα το παίρνει αυτόματα κατά τη φόρτωση.
  const icons = {
    up: ['2.6', 'M12 20V4m-7 7 7-7 7 7'],
    down: ['2.6', 'M12 4v16m-7-7 7 7 7-7'],
    import: ['2.4', 'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5'],
    export: ['2.4', 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5'],
    menu: ['2.2', 'M4 6h16M4 12h16M4 18h16'],
    edit: ['2.2', 'M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20zM14.5 7.5l3 3'],
    close: ['2.2', 'M6 6l12 12M18 6 6 18']
  };
  function schoolIcon(name) {
    const icon = icons[name];
    if (!icon) return '';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${icon[0]}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${icon[1]}"/></svg>`;
  }
  for (const element of document.querySelectorAll('[data-school-icon]')) {
    if (!element.firstElementChild) element.insertAdjacentHTML('afterbegin', schoolIcon(element.dataset.schoolIcon));
  }

  // Πολλαπλή επιλογή σε λίστα. order: τα κλειδιά των γραμμών με τη σειρά που εμφανίζονται.
  // Επιστρέφουν {selected:Set, anchor} με τη νέα επιλογή· η εφαρμογή αποφασίζει πώς τη ζωγραφίζει.
  //   click(order, selected, anchor, key, event)  κλικ: απλό, Ctrl/Cmd (εναλλαγή), Shift (εύρος· με Ctrl προστίθεται)
  //   step(order, selected, anchor, delta)        βέλος πάνω (−1) ή κάτω (+1): μία γραμμή, χωρίς να βγει από τη λίστα
  //   isSelectAll(event)                          Ctrl/Cmd+A, και με ελληνικό πληκτρολόγιο
  const schoolListSelection = Object.freeze({
    click(order, selected, anchor, key, event) {
      const additive = !!(event?.ctrlKey || event?.metaKey);
      if (event?.shiftKey && order.includes(anchor)) {
        const from = order.indexOf(anchor), to = order.indexOf(key);
        const next = new Set(additive ? selected : []);
        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) next.add(order[i]);
        return {selected: next, anchor};
      }
      if (additive) {
        const next = new Set(selected);
        if (next.has(key)) next.delete(key); else next.add(key);
        return {selected: next, anchor: key};
      }
      return {selected: new Set([key]), anchor: key};
    },
    step(order, selected, anchor, delta) {
      if (!order.length) return {selected: new Set(), anchor: null};
      // From the last clicked row (even if Ctrl+click just unselected it), else from the first selected row.
      let index = order.indexOf(anchor);
      if (index < 0) index = order.findIndex(key => selected.has(key));
      const next = index < 0 ? (delta > 0 ? 0 : order.length - 1) : Math.max(0, Math.min(order.length - 1, index + delta));
      return {selected: new Set([order[next]]), anchor: order[next]};
    },
    isSelectAll(event) {
      return !!(event.ctrlKey || event.metaKey) && !event.altKey &&
        (event.code === 'KeyA' || ['a', 'α'].includes(String(event.key).toLowerCase()));
    }
  });

  // Επικοινωνία με το Κεντρικό Μενού (πρωτόκολλο host ↔ υποεφαρμογή).
  //   schoolHost.hosted                  true όταν η σελίδα τρέχει μέσα στο Κεντρικό Μενού
  //   schoolHost.post(message)           στέλνει μήνυμα· όταν η σελίδα είναι ανοιχτή μόνη της, δεν κάνει τίποτα
  //   schoolHost.on(type, handler)       handler(message) για κάθε μήνυμα αυτού του τύπου από το Κεντρικό Μενού
  //   schoolHost.request(type, payload, {timeoutMessage})
  //                                      αίτημα με requestId· επιστρέφει Promise με το context (για :save)
  //                                      ή το result (για :fet / :file). Το :save απαντά με <πρόθεμα>:result
  //                                      χωρίς ack και έχει όριο 120 s. Τα άλλα αιτήματα απαντούν με
  //                                      <type>-ack αμέσως και <type>-result μετά· το όριο των 120 s αφορά
  //                                      μόνο το ack, γιατί ένα παράθυρο επιλογής αρχείου μένει ανοιχτό
  //                                      όσο χρειάζεται ο χρήστης. Όταν η σελίδα είναι ανοιχτή μόνη της,
  //                                      το αίτημα απορρίπτεται αμέσως.
  const hosted = parent !== window;
  const local = location.protocol === 'file:' || location.origin === 'null';
  const origin = local ? '*' : location.origin;
  const pending = new Map(), handlers = new Map();
  let requestSequence = 0;
  const post = message => { if (hosted) parent.postMessage(message, origin); };
  const schoolHost = Object.freeze({
    hosted,
    post,
    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(handler);
      return () => handlers.get(type)?.delete(handler);
    },
    request(type, payload = {}, options = {}) {
      if (!hosted) return Promise.reject(Error('Η εφαρμογή δεν εκτελείται μέσα από το Κεντρικό Μενού.'));
      const prefix = type.slice(0, type.lastIndexOf(':')), save = type === prefix + ':save';
      const entry = {result: save ? prefix + ':result' : type + '-result', ack: save ? '' : type + '-ack'};
      return new Promise((resolve, reject) => {
        const requestId = prefix.replace(/^school-/, '') + '-' + Date.now().toString(36) + '-' + (++requestSequence);
        entry.timer = setTimeout(() => {
          pending.delete(requestId);
          reject(Error(options.timeoutMessage || 'Δεν απάντησε το κεντρικό μενού. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.'));
        }, 120000);
        Object.assign(entry, {resolve, reject});
        pending.set(requestId, entry);
        post({...payload, type, requestId});
      });
    }
  });
  if (hosted) {
    window.addEventListener('message', event => {
      if (event.source !== parent || (!local && event.origin !== location.origin)) return;
      const message = event.data;
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
      const entry = typeof message.requestId === 'string' ? pending.get(message.requestId) : null;
      if (entry && message.type === entry.ack) { clearTimeout(entry.timer); return; }
      if (entry && message.type === entry.result) {
        clearTimeout(entry.timer); pending.delete(message.requestId);
        if (message.ok) entry.resolve('context' in message ? message.context : message.result);
        else entry.reject(Error(message.error || 'Η ενέργεια δεν ολοκληρώθηκε.'));
        return;
      }
      for (const handler of handlers.get(message.type) || []) handler(message);
    });

    // Menu button «☰» of the shared header, and the application name: both open the sidebar of the Index.
    // The Index then hides its own tab while the sidebar is closed. Pages without the shared header keep the Index's tab.
    const brand = document.querySelector('header.page-head > .toolbar-brand');
    if (brand) {
      const openMenu = () => post({type: 'school-app:open-menu'});
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'subapp-nav-button';
      button.title = 'Μενού εφαρμογών'; button.setAttribute('aria-label', 'Άνοιγμα μενού εφαρμογών');
      button.insertAdjacentHTML('afterbegin', schoolIcon('menu'));
      button.addEventListener('click', openMenu);
      // Inside .toolbar-brand, before the name: button and name always stay in the same row.
      brand.prepend(button);
      brand.querySelector('.brand-menu')?.addEventListener('click', openMenu);
      post({type: 'school-app:menu-button'});
    }

    // Activity inside the sub-application resets the Index's idle timer.
    let lastSent = 0;
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'input', 'wheel', 'touchstart']) {
      document.addEventListener(type, event => {
        if (!event.isTrusted) return;
        const now = Date.now(); if (now - lastSent < 500) return;
        lastSent = now;
        post({type: 'school-app:activity'});
      }, {capture: true, passive: true});
    }
  }

  // The real height of the shared header (it grows when the header wraps), for layouts below it.
  const pageHead = document.querySelector('header.page-head');
  if (pageHead) {
    const update = () => document.documentElement.style.setProperty('--subapp-header-height', pageHead.getBoundingClientRect().height + 'px');
    update();
    if (typeof ResizeObserver === 'function') new ResizeObserver(update).observe(pageHead);
  }

  window.schoolMessage = schoolMessage;
  window.schoolConfirm = schoolConfirm;
  window.schoolChoiceDialog = schoolChoiceDialog;
  window.schoolProgramImport = schoolProgramImport;
  window.schoolReplaceProgram = schoolReplaceProgram;
  window.schoolColorPicker = schoolColorPicker;
  window.schoolColor = Object.freeze({normalize: normalColor, ink: inkFor, valid: validColor});
  window.schoolEscape = schoolEscape;
  window.schoolIcon = schoolIcon;
  window.schoolListSelection = schoolListSelection;
  window.schoolHost = schoolHost;
})();
