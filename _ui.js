/*
 * Εφαρμογές σχολείου — Κοινές λειτουργίες περιβάλλοντος χρήστη
 * Έκδοση αρχείου: 0.23
 * Όνομα κατά την εγκατάσταση: _ui.js
 *
 * Φορτώνεται με <script src="_ui.js"></script> από το Κεντρικό Μενού και από κάθε υποεφαρμογή,
 * πριν από το δικό τους script. Ορίζει:
 *   window.schoolConfirm, window.schoolMessage    διάλογοι ενημέρωσης και επιβεβαίωσης
 *   window.schoolChoiceDialog                      διάλογος με επιλογές και ασύγχρονες ενέργειες
 *   window.schoolProgramImport                     κοινός διάλογος εισαγωγής προγράμματος (ανάλυση → κατασκευή)
 *   window.schoolReplaceProgram                    ερώτηση πριν αντικατασταθεί πρόγραμμα περιόδου
 *   window.schoolColorPicker, window.schoolColor   επιλογέας χρώματος και βοηθητικά χρώματος
 *   window.schoolRichText                          κείμενο με μορφοποίηση (μπάρα και πεδίο)
 *   window.schoolTags                              ετικέτες: chips, επιλογέας, διαχείριση (χρειάζεται το _data.js)
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
 * Κουμπιά κάτω δεξιά σε κάθε διάλογο: τέρμα δεξιά η «Ακύρωση», αριστερά της η προεπιλεγμένη ενέργεια
 * (αποδοχή) και πιο αριστερά οι υπόλοιπες. Κάτω αριστερά δεν μπαίνουν κουμπιά.
 * Η εμφάνιση των διαλόγων ορίζεται στο _ui.css (.school-confirm, .school-choice-*, .school-import-*,
 *   .school-color-picker, .school-richtext-*, .school-tag*)
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
      // Η αποδοχή αριστερά, η «Ακύρωση» τέρμα δεξιά. Η εστίαση πηγαίνει στην «Ακύρωση» (ασφαλέστερη).
      const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'confirm-accept';
      accept.textContent = o.confirm ? o.accept : 'Εντάξει';
      accept.onclick = () => { accepted = true; dialog.close(); };
      actions.append(accept);
      if (o.confirm) {
        cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Ακύρωση';
        cancel.onclick = () => dialog.close();
        actions.append(cancel);
      }
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

  // Η κοινή σειρά των κουμπιών κάτω δεξιά: οι υπόλοιπες ενέργειες, η αποδοχή, και τέρμα δεξιά η «Ακύρωση».
  const isCancelAction = spec => !!spec.cancel || (spec.cancel !== false && spec.label === 'Ακύρωση');
  function orderedActions(list) {
    const rank = spec => isCancelAction(spec) ? 2 : spec.accept ? 1 : 0;
    return list.map((spec, index) => ({spec, index})).sort((a, b) => rank(a.spec) - rank(b.spec) || a.index - b.index).map(item => item.spec);
  }

  // Διάλογος με επιλογές: τίτλος, περιεχόμενο, μεγάλα κουμπιά επιλογών (π.χ. «Τελευταίο αρχείο» /
  // «Επιλογή άλλου αρχείου») και κουμπιά ενεργειών κάτω δεξιά.
  //   options.title    τίτλος
  //   options.content  κείμενο ή στοιχείο DOM, ή πίνακας από αυτά (το κείμενο μπαίνει σε <p> με textContent)
  //   options.choices  [{label, disabled, title, value, run}]  κουμπιά επιλογής, το ένα κάτω από το άλλο
  //   options.actions  [{label, accept, cancel, disabled, value, run}] κουμπιά κάτω δεξιά (προεπιλογή: «Ακύρωση»).
  //                    Μπαίνουν πάντα με την ίδια σειρά, όποια σειρά κι αν έχει ο πίνακας: τέρμα δεξιά η
  //                    «Ακύρωση» (cancel:true ή ετικέτα «Ακύρωση»), αριστερά της το κουμπί αποδοχής (accept:true)
  //                    και πιο αριστερά τα υπόλοιπα, με τη σειρά του πίνακα.
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
      actions.append(...orderedActions(options.actions || [{label: 'Ακύρωση'}]).map(button));
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
        {label: options.accept || 'Εισαγωγή', accept: true, get disabled() { return !analysis?.ok; },
          run: async () => options.build(analysis, {unmatched: unmatchedBox.querySelector('input:checked')?.value === 'drop' ? 'drop' : 'keep', direct: false})},
        {label: 'Ακύρωση', cancel: true}
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

  // Επιλογέας χρώματος: σταθερή παλέτα και 9 σταθερές θέσεις προσαρμοσμένων χρωμάτων, που ο browser θυμάται.
  // Διπλό κλικ (ή F2) σε θέση ανοίγει τον επιλογέα του browser και αλλάζει το χρώμα της. Ένα αρχικό χρώμα που
  // δεν υπάρχει στην παλέτα ούτε στις θέσεις μένει επιλεγμένο χωρίς να μπει σε θέση (οι θέσεις δεν μετακινούνται).
  // Τίτλος πάνω· κάτω δεξιά «Επιλογή» και, τέρμα δεξιά, «Ακύρωση», όπως σε όλους τους διαλόγους.
  // Επιστρέφει Promise με το χρώμα (#rrggbb) στην «Επιλογή», ή null στην «Ακύρωση»/Esc.
  // Επιλογές:
  //   title, accept   τίτλος και ετικέτα του κουμπιού αποδοχής
  //   anchor          στοιχείο (π.χ. το κουμπί που πατήθηκε): ο επιλογέας ανοίγει κάτω από αυτό, με τη δεξιά
  //                   του άκρη στη δεξιά άκρη του στοιχείου (ή, αν έτσι βγαίνει από τη σελίδα αριστερά, με την
  //                   αριστερή στην αριστερή)· αν δεν χωρά από κάτω, από πάνω· αν δεν χωρά καθόλου, στο κέντρο. Κλικ έξω από τον επιλογέα τον κλείνει όπως η «Ακύρωση». Χωρίς anchor: στο κέντρο.
  //   defaultColor    true: προσθέτει την επιλογή «Αυτόματο» (το προεπιλεγμένο χρώμα)· τότε η τιμή μπορεί να
  //                   είναι και '' (κενό κείμενο) όταν επιλέχθηκε το «Αυτόματο».
  const palette = [
    '#a8d8ff','#8be8a8','#fff36b','#ffc16d','#ff6254','#d07ed4','#c5a185','#ffffff','#808085',
    '#5d9be5','#4fd87a','#ffe55f','#ffa548','#ef2f3e','#b962c6','#b4865e','#f5f5f5','#5e5e65',
    '#3387de','#32c96b','#ffda31','#ff7c00','#e6192b','#903eb6','#96683e','#dddddd','#3f3a4a',
    '#1f73cc','#2db864','#f0b100','#c84e00','#b31332','#71378e','#60442c','#aaaaaa','#000000'
  ];
  const customKey = 'school-ui:custom-colors';
  const customDefaults = ['#f27e00','#2f68b6','#fff1a8','#add7f4','#fac9c9','#f5bfc0','#dfa0a2','#dc9698','#a2d6b5'];
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
      customColors = Array.isArray(saved) ? saved.filter(validColor).map(c => normalColor(c)).slice(0, 9) : null;
    } catch { customColors = null; }
    if (!customColors) customColors = [];
    while (customColors.length < 9) customColors.push(customDefaults[customColors.length]);
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
      const withDefault = !!options.defaultColor;
      let selected = withDefault && (color === '' || color == null) ? '' : normalColor(color);
      const custom = loadCustomColors();
      let customSelectedIndex = custom.indexOf(selected);

      const title = document.createElement('div'); title.id = 'school-color-picker-title';
      title.className = 'school-color-picker-title'; title.textContent = options.title || 'Επιλογή χρώματος';
      const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'confirm-accept';
      accept.textContent = options.accept || 'Επιλογή';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Ακύρωση';
      const footer = document.createElement('div'); footer.className = 'school-color-picker-actions';
      footer.append(accept, cancel);
      // «Αυτόματο»: το προεπιλεγμένο χρώμα κειμένου (χωρίς δικό του χρώμα).
      let auto = null;
      if (withDefault) {
        auto = document.createElement('button'); auto.type = 'button'; auto.className = 'school-color-picker-auto';
        const swatch = document.createElement('span'); swatch.className = 'school-color-picker-auto-swatch'; swatch.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span'); label.textContent = 'Αυτόματο';
        auto.append(swatch, label);
        auto.onclick = () => { selected = ''; customSelectedIndex = -1; render(); };
      }
      const grid = document.createElement('div'); grid.className = 'school-color-picker-grid';
      const customTitle = document.createElement('div'); customTitle.className = 'school-color-picker-custom-title';
      customTitle.textContent = 'Προσαρμογή';
      const customList = document.createElement('div'); customList.className = 'school-color-picker-custom';
      // The native input lives inside the dialog, so it is not inert while the dialog is modal.
      const native = document.createElement('input'); native.type = 'color'; native.tabIndex = -1;
      native.className = 'school-color-picker-native'; native.setAttribute('aria-hidden', 'true');

      // Keep custom swatch nodes in place on a click, so a second click can trigger dblclick.
      const updateSelection = () => {
        for (const [index, button] of [...customList.children].entries()) {
          const active = index === customSelectedIndex;
          button.classList.toggle('selected', active);
          button.setAttribute('aria-pressed', String(active));
        }
        for (const [index, button] of [...grid.children].entries()) {
          const active = customSelectedIndex < 0 && palette[index] === selected;
          button.classList.toggle('selected', active);
          button.setAttribute('aria-pressed', String(active));
        }
        if (auto) { auto.classList.toggle('selected', selected === ''); auto.setAttribute('aria-pressed', String(selected === '')); }
      };
      let editingIndex = -1;
      const openCustomColor = (index, button) => {
        editingIndex = index;
        selected = custom[index];
        customSelectedIndex = index;
        updateSelection();
        native.value = selected;
        // Position the native picker over the swatch that was double-clicked.
        const rect = button.getBoundingClientRect();
        native.style.left = rect.left + 'px';
        native.style.top = rect.top + 'px';
        native.style.width = rect.width + 'px';
        native.style.height = rect.height + 'px';
        native.click();
      };
      const choice = (value, customIndex = -1) => {
        const isSelected = customIndex >= 0 ? customIndex === customSelectedIndex : customSelectedIndex < 0 && value === selected;
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'school-color-picker-choice' + (isSelected ? ' selected' : '');
        button.style.setProperty('--choice-color', value);
        button.style.setProperty('--choice-ink', inkFor(value));
        button.setAttribute('aria-label', customIndex >= 0 ? 'Προσαρμοσμένο χρώμα ' + value + ' (διπλό κλικ ή F2 για αλλαγή)' : 'Χρώμα ' + value);
        if (customIndex >= 0) button.title = 'Διπλό κλικ ή F2 για αλλαγή του χρώματος';
        button.setAttribute('aria-pressed', String(isSelected));
        button.onclick = () => {
          selected = customIndex >= 0 ? custom[customIndex] : value;
          customSelectedIndex = customIndex;
          if (customIndex >= 0) updateSelection(); else render();
        };
        if (customIndex >= 0) {
          button.ondblclick = () => openCustomColor(customIndex, button);
          button.onkeydown = event => { if (event.key === 'F2') { event.preventDefault(); openCustomColor(customIndex, button); } };
        }
        return button;
      };
      const render = () => {
        grid.replaceChildren(...palette.map(value => choice(value)));
        customList.replaceChildren(...custom.map((value, index) => choice(value, index)));
        updateSelection();
      };
      let done = false;
      native.oninput = () => {
        if (editingIndex < 0) return;
        selected = normalColor(native.value, custom[editingIndex]);
        custom[editingIndex] = selected;
        customSelectedIndex = editingIndex;
        saveCustomColors();
        // The swatch is changed in place: it keeps the focus (F2) and the double click.
        const button = customList.children[editingIndex];
        if (button) {
          button.style.setProperty('--choice-color', selected);
          button.style.setProperty('--choice-ink', inkFor(selected));
          button.setAttribute('aria-label', 'Προσαρμοσμένο χρώμα ' + selected + ' (διπλό κλικ ή F2 για αλλαγή)');
        }
        updateSelection();
      };
      cancel.onclick = () => dialog.close();
      accept.onclick = () => { done = true; dialog.close(); };
      dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
      // Next to the anchor (below it, else above it), with the right edges lined up; centred when it does not fit.
      const anchor = options.anchor?.isConnected ? options.anchor : null;
      const place = () => {
        if (!anchor || !dialog.open) return;
        const gap = 4, edge = 8, box = anchor.getBoundingClientRect();
        const width = dialog.offsetWidth, height = dialog.offsetHeight;
        const viewWidth = document.documentElement.clientWidth, viewHeight = window.innerHeight;
        let top = box.bottom + gap;
        if (top + height > viewHeight - edge) top = box.top - gap - height;
        const fits = width <= viewWidth - 2 * edge && top >= edge;
        dialog.classList.toggle('school-color-picker-anchored', fits);
        if (!fits) { dialog.style.removeProperty('left'); dialog.style.removeProperty('top'); return; }
        // Right edges lined up; when that would leave the page on the left, left edges lined up.
        const left = box.right - width >= edge ? box.right - width : box.left;
        dialog.style.left = Math.max(edge, Math.min(left, viewWidth - edge - width)) + 'px';
        dialog.style.top = top + 'px';
      };
      if (anchor) {
        window.addEventListener('resize', place);
        // A click on the backdrop (outside the picker) closes it like «Ακύρωση».
        dialog.addEventListener('click', event => {
          if (event.target !== dialog) return;
          const box = dialog.getBoundingClientRect();
          if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
        });
      }
      dialog.addEventListener('close', () => {
        window.removeEventListener('resize', place);
        dialog.remove();
        if (previous?.isConnected) previous.focus();
        resolve(done ? selected : null);
      }, {once: true});
      dialog.append(title, ...(auto ? [auto] : []), grid, customTitle, customList, footer, native);
      document.body.append(dialog); render();
      try {
        dialog.showModal(); place();
        (grid.querySelector('.selected') || customList.querySelector('.selected') || (auto?.classList.contains('selected') ? auto : null) || accept).focus();
      }
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
    close: ['2.2', 'M6 6l12 12M18 6 6 18'],
    // Μορφοποίηση κειμένου (schoolRichText).
    bold: ['3.3', 'M7 4h5.5a4 4 0 0 1 0 8H7zM7 12h6.5a4 4 0 0 1 0 8H7z'],
    italic: ['2', 'M10 4h8M6 20h8M15 4 9 20'],
    underline: ['2', 'M5.5 4v9.5a6.5 6.5 0 0 0 13 0V4M4 23.5h16'],
    'text-color': ['2', 'M5.5 20 12 4l6.5 16M7.9 14h8.2'],
    'chevron-down': ['2.4', 'm6 9 6 6 6-6'],
    'bullet-list': ['2', 'M10 6h10M10 12h10M10 18h10M4.5 5.2a.8.8 0 1 0 0 1.6.8.8 0 1 0 0-1.6zM4.5 11.2a.8.8 0 1 0 0 1.6.8.8 0 1 0 0-1.6zM4.5 17.2a.8.8 0 1 0 0 1.6.8.8 0 1 0 0-1.6z'],
    'number-list': ['1.8', 'M10 6h10M10 12h10M10 18h10M3.6 4.4 5 3.5v5M3.4 8.5h3.2M3.5 15a1.6 1.6 0 0 1 3.1.3c0 .9-.8 1.4-3.1 3.2h3.2'],
    'clear-format': ['2', 'M5 5h11M10.5 5 8 18M14 14l6 6M20 14l-6 6']
  };
  function schoolIcon(name) {
    const icon = icons[name];
    if (!icon) return '';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${icon[0]}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${icon[1]}"/></svg>`;
  }
  for (const element of document.querySelectorAll('[data-school-icon]')) {
    if (!element.firstElementChild) element.insertAdjacentHTML('afterbegin', schoolIcon(element.dataset.schoolIcon));
  }

  // Κείμενο με μορφοποίηση: μπάρα (B I U | χρώμα ▾ | λίστες | καθαρισμός) πάνω από πεδίο contenteditable.
  //   schoolRichText.create({html, labelledBy, label, color, actions}) → {element, editor, html, setHtml(html), focus()}
  //     html        το αρχικό κείμενο (καθαρίζεται με το SchoolHtml.sanitize του _data.js, όταν είναι φορτωμένο)
  //     labelledBy  id της ετικέτας του πεδίου (ή label: κείμενο για aria-label)
  //     color       το αρχικό χρώμα του «A», όταν ο browser δεν θυμάται ακόμη κάποιο (#rrggbb)
  //     actions     [{label, title, accept, run}]: κουμπιά κειμένου στο δεξί άκρο της μπάρας (π.χ. «Αποδοχή»,
  //                 «Ακύρωση» μιας σημείωσης)· accept:true για το κύριο κουμπί, run() στο κλικ. Δεν μπαίνουν
  //                 στην κίνηση με τα βέλη της μπάρας· έχουν δική τους στάση Tab.
  //   element: το κουτί (.school-richtext) με τη μπάρα και το πεδίο, για να μπει στη σελίδα.
  //   html: getter με το καθαρισμένο HTML του πεδίου.
  // Το τελευταίο χρώμα του «A» το θυμάται ο browser, κοινό για όλες τις εφαρμογές. Το «▾» ανοίγει το
  // schoolColorPicker κάτω από το βελάκι, με την επιλογή «Αυτόματο». Συντομεύσεις: Ctrl+B, Ctrl+I, Ctrl+U
  // (του browser) και Ctrl+\ (καθαρισμός)· Tab / Shift+Tab μέσα σε λίστα αλλάζει το επίπεδο. Η επικόλληση
  // καθαρίζεται αμέσως. Η εμφάνιση ορίζεται στο _ui.css (.school-richtext-*).
  const textColorKey = 'school-ui:text-color';
  const loadTextColor = fallback => {
    try { const saved = localStorage.getItem(textColorKey); if (validColor(saved)) return normalColor(saved); } catch {}
    return normalColor(fallback, '#ff7800');
  };
  const saveTextColor = value => { try { localStorage.setItem(textColorKey, value); } catch {} };
  const cleanHtml = html => window.SchoolHtml ? window.SchoolHtml.sanitize(html) : schoolEscape(String(html ?? '').replace(/<[^>]*>/g, ''));
  const richTextEditors = new Set();
  document.addEventListener('selectionchange', () => {
    for (const instance of richTextEditors) {
      if (!instance.editor.isConnected) { richTextEditors.delete(instance); continue; }
      instance.selectionChanged();
    }
  });
  const RICH_BUTTONS = [
    ['bold', 'bold', 'Έντονα (Ctrl+B)'],
    ['italic', 'italic', 'Πλάγια (Ctrl+I)'],
    ['underline', 'underline', 'Υπογράμμιση (Ctrl+U)'],
    '|',
    ['color', 'text-color', 'Χρώμα κειμένου'],
    ['colorMenu', 'chevron-down', 'Επιλογή χρώματος κειμένου…'],
    '|',
    ['insertUnorderedList', 'bullet-list', 'Λίστα με κουκκίδες'],
    ['insertOrderedList', 'number-list', 'Αριθμημένη λίστα'],
    '|',
    ['removeFormat', 'clear-format', 'Καθαρισμός μορφοποίησης (Ctrl+\\)']
  ];
  const STATE_COMMANDS = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];

  function createRichText(options = {}) {
    const box = document.createElement('div'); box.className = 'school-richtext';
    const toolbar = document.createElement('div'); toolbar.className = 'school-richtext-toolbar';
    toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', 'Μορφοποίηση κειμένου');
    const editor = document.createElement('div'); editor.className = 'school-richtext-editor';
    editor.contentEditable = 'true'; editor.spellcheck = true;
    editor.setAttribute('role', 'textbox'); editor.setAttribute('aria-multiline', 'true');
    if (options.labelledBy) editor.setAttribute('aria-labelledby', options.labelledBy);
    else if (options.label) editor.setAttribute('aria-label', options.label);
    editor.innerHTML = cleanHtml(options.html);
    let textColor = loadTextColor(options.color);
    let range = null;   // The last selection inside the editor, for the buttons and the colour picker.

    const buttons = {}, order = [];
    let group = document.createElement('span'); group.className = 'school-richtext-group';
    const groups = [group];
    for (const item of RICH_BUTTONS) {
      if (item === '|') {
        const sep = document.createElement('span'); sep.className = 'school-richtext-sep'; sep.setAttribute('aria-hidden', 'true');
        groups.push(sep);
        group = document.createElement('span'); group.className = 'school-richtext-group'; groups.push(group);
        continue;
      }
      const [command, icon, title] = item, button = document.createElement('button');
      button.type = 'button'; button.title = title; button.setAttribute('aria-label', title.replace(/ \(Ctrl.*\)$/, ''));
      button.dataset.command = command; button.tabIndex = order.length ? -1 : 0;
      button.insertAdjacentHTML('afterbegin', schoolIcon(icon));
      if (STATE_COMMANDS.includes(command)) button.setAttribute('aria-pressed', 'false');
      // The editor keeps its selection (and focus) when a button is clicked with the mouse.
      button.addEventListener('mousedown', event => event.preventDefault());
      buttons[command] = button; order.push(button); group.append(button);
    }
    buttons.color.classList.add('school-richtext-color');
    // The bar in the last colour, drawn like the line of «U» (below the letter, a little outside the icon box):
    // a faint outline under it keeps a light colour visible.
    buttons.color.querySelector('svg').insertAdjacentHTML('beforeend',
      '<path class="school-richtext-color-outline" d="M4 23.5h16"/><path class="school-richtext-color-bar" d="M4 23.5h16"/>');
    buttons.colorMenu.classList.add('school-richtext-color-menu');
    buttons.colorMenu.setAttribute('aria-haspopup', 'dialog');
    toolbar.append(...groups);
    if (options.actions?.length) {
      const actions = document.createElement('span'); actions.className = 'school-richtext-actions';
      for (const spec of options.actions) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = spec.label;
        if (spec.accept) button.className = 'primary';
        if (spec.title) { button.title = spec.title; button.setAttribute('aria-label', spec.title); }
        button.addEventListener('click', () => spec.run?.());
        actions.append(button);
      }
      toolbar.append(actions);
    }
    box.append(toolbar, editor);

    const inEditor = node => !!node && (node === editor || editor.contains(node));
    const remember = () => {
      const selection = getSelection();
      if (selection?.rangeCount && inEditor(selection.anchorNode)) range = selection.getRangeAt(0).cloneRange();
    };
    const restore = () => {
      editor.focus();
      if (range && inEditor(range.startContainer)) { const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); }
    };
    const showColor = () => {
      buttons.color.style.setProperty('--school-richtext-color', textColor);
      buttons.color.title = 'Χρώμα κειμένου (' + textColor + ')';
    };
    const updateState = () => {
      for (const command of STATE_COMMANDS) {
        let on = false;
        try { on = document.queryCommandState(command); } catch {}
        buttons[command].setAttribute('aria-pressed', String(!!on));
      }
    };
    // The selection as text positions inside the editor, to put the caret back after a list command
    // (Chrome may move it to the start of the line, although the text does not change).
    const textPoint = (container, offset) => {
      const before = document.createRange(); before.selectNodeContents(editor); before.setEnd(container, offset);
      return {count: before.toString().length, atStart: container.nodeType === Node.TEXT_NODE && offset === 0};
    };
    const pointAt = ({count, atStart}) => {
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      let seen = 0, node = null, last = null;
      while ((node = walker.nextNode())) {
        const length = node.nodeValue.length;
        if (atStart ? count < seen + length : count <= seen + length) return [node, count - seen];
        seen += length; last = node;
      }
      return last ? [last, last.nodeValue.length] : [editor, editor.childNodes.length];
    };
    const exec = (command, value = null) => {
      restore();
      const selection = getSelection(), before = selection.rangeCount ? selection.getRangeAt(0) : null;
      const keep = /List$|^(indent|outdent)$/.test(command) && before && inEditor(before.startContainer)
        ? [textPoint(before.startContainer, before.startOffset), textPoint(before.endContainer, before.endOffset)] : null;
      document.execCommand(command, false, value);
      // Only when the browser moved the caret to another place in the text.
      const moved = keep && selection.rangeCount && inEditor(selection.anchorNode) &&
        textPoint(selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset).count !== keep[0].count;
      if (moved) {
        const after = document.createRange();
        after.setStart(...pointAt(keep[0])); after.setEnd(...pointAt(keep[1]));
        selection.removeAllRanges(); selection.addRange(after);
      }
      remember(); updateState();
    };
    const applyColor = color => {
      restore();
      // With CSS the colour is written as <span style="color">; the other commands keep <b>, <i>, <u>.
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('foreColor', false, color);
      document.execCommand('styleWithCSS', false, false);
      remember();
    };
    // «Αυτόματο»: the selected text loses its own colour; with no selection, the text typed next has the default colour.
    // The browser first colours the selection with a marker colour (it splits the coloured parts around the
    // selection), and then every element with the marker colour loses its colour.
    const MARKER = 'rgb(1, 2, 3)';
    const applyDefaultColor = () => {
      restore();
      const selection = getSelection(), current = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (!current || current.collapsed || !inEditor(current.commonAncestorContainer)) { applyColor(getComputedStyle(editor).color); return; }
      applyColor(MARKER);
      for (const element of editor.querySelectorAll('[style],font[color]')) {
        if (element.style.color.replace(/\s/g, '') === MARKER.replace(/\s/g, '') || /^#010203$/i.test(element.getAttribute('color') || '')) {
          element.style.removeProperty('color'); element.removeAttribute('color');
          if (!element.getAttribute('style')) element.removeAttribute('style');
          if ((element.tagName === 'SPAN' || element.tagName === 'FONT') && !element.attributes.length) element.replaceWith(...element.childNodes);
        }
      }
      editor.normalize();
      remember();
    };
    const chooseColor = async () => {
      remember();
      const chosen = await schoolColorPicker(textColor, {title: 'Χρώμα κειμένου', accept: 'Εφαρμογή', anchor: buttons.colorMenu, defaultColor: true});
      if (chosen === null) { restore(); return; }
      if (chosen === '') { applyDefaultColor(); return; }
      textColor = chosen; saveTextColor(chosen); showColor(); applyColor(chosen);
    };
    const listItem = () => {
      const selection = getSelection();
      let node = selection?.rangeCount ? selection.anchorNode : null;
      while (node && node !== editor) { if (node.nodeName === 'LI') return node; node = node.parentNode; }
      return null;
    };

    toolbar.addEventListener('click', event => {
      const button = event.target.closest('button[data-command]');
      if (!button) return;
      const command = button.dataset.command;
      if (command === 'color') applyColor(textColor);
      else if (command === 'colorMenu') chooseColor();
      else exec(command);
    });
    // One tab stop for the toolbar; the arrow keys, Home and End move between its buttons.
    toolbar.addEventListener('keydown', event => {
      const index = order.indexOf(document.activeElement);
      if (index < 0) return;
      const next = {ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: order.length - 1}[event.key];
      if (next === undefined) return;
      event.preventDefault();
      const target = order[(next + order.length) % order.length];
      order.forEach(button => { button.tabIndex = button === target ? 0 : -1; });
      target.focus();
    });
    editor.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.code === 'Backslash') { event.preventDefault(); exec('removeFormat'); return; }
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey && listItem()) {
        event.preventDefault(); exec(event.shiftKey ? 'outdent' : 'indent');
      }
    });
    editor.addEventListener('paste', event => {
      const data = event.clipboardData;
      if (!data) return;
      event.preventDefault();
      const html = data.getData('text/html');
      const clean = html ? cleanHtml(html.replace(/^[\s\S]*<!--StartFragment-->|<!--EndFragment-->[\s\S]*$/g, ''))
        : schoolEscape(data.getData('text/plain')).replace(/\r?\n/g, '<br>');
      // Inserted as it is: execCommand('insertHTML') would add styles of its own (e.g. white-space).
      const selection = getSelection();
      if (!selection?.rangeCount || !inEditor(selection.anchorNode)) return;
      const target = selection.getRangeAt(0), template = document.createElement('template');
      template.innerHTML = clean;
      const last = template.content.lastChild;
      target.deleteContents(); target.insertNode(template.content);
      if (last) { target.setStartAfter(last); target.collapse(true); selection.removeAllRanges(); selection.addRange(target); }
      editor.dispatchEvent(new Event('input', {bubbles: true}));
      remember();
    });
    for (const type of ['keyup', 'mouseup', 'input', 'focus']) editor.addEventListener(type, () => { remember(); updateState(); });
    // Outside the box (field and toolbar) the toolbar shows no format as pressed.
    box.addEventListener('focusout', event => {
      if (event.relatedTarget && box.contains(event.relatedTarget)) return;
      for (const command of STATE_COMMANDS) buttons[command].setAttribute('aria-pressed', 'false');
    });

    const instance = {
      editor,
      selectionChanged() {
        const selection = getSelection();
        if (selection?.rangeCount && inEditor(selection.anchorNode)) { remember(); updateState(); }
      }
    };
    richTextEditors.add(instance);
    showColor();
    return {
      element: box, editor,
      get html() { return cleanHtml(editor.innerHTML); },
      setHtml(value) { editor.innerHTML = cleanHtml(value); range = null; updateState(); },
      focus() { editor.focus(); }
    };
  }
  const schoolRichText = Object.freeze({create: createRichText});

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

  // ---- Ετικέτες (window.schoolTags) ----
  // Τα κοινά components των ετικετών· χρειάζονται το _data.js (SchoolTags, SchoolClasses, SchoolTimetable,
  // SchoolStudents, SchoolText). data = {tags, classes, staff, students}: το μητρώο του έτους και ό,τι χρειάζεται
  // για την εμφάνιση. Η εμφάνιση είναι στο _ui.css (.school-tag, .school-tags, .school-tag-picker, .school-tag-manager).
  const TAG_GROUP_TITLES = {general: 'Γενικές', class: 'Τμήματα', staff: 'Εκπαιδευτικοί', student: 'Μαθητές'};
  const TAG_KIND_TITLES = {general: 'Ετικέτα', class: 'Τμήμα', staff: 'Εκπαιδευτικός', student: 'Μαθητής'};
  const tagsLib = () => {
    if (!window.SchoolTags || !window.SchoolClasses || !window.SchoolTimetable || !window.SchoolStudents) throw Error('Οι ετικέτες χρειάζονται το _data.js. Βεβαιώσου ότι η εφαρμογή και τα κοινά αρχεία είναι η τελευταία έκδοση.');
    return window.SchoolTags;
  };
  const tagSearchKey = value => String(value ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const tagCancelled = () => Object.assign(Error('Η ενέργεια ακυρώθηκε.'), {name: 'AbortError'});
  const tagPlural = (count, one, many) => count + ' ' + (count === 1 ? one : many);
  // Η χρήση μιας γενικής ετικέτας ως κείμενο: «5 Προσωπικές Σημειώσεις, 1 …». usage(id) → [{one, many, count}].
  const tagUsageText = list => (list || []).filter(item => item?.count > 0).map(item => tagPlural(item.count, item.one, item.many)).join(', ');
  const tagUsageCount = list => (list || []).reduce((sum, item) => sum + (Number(item?.count) || 0), 0);

  // Το αρχικό χρώμα αποθηκεύεται ανέπαφο: τα φωτεινά chips παίρνουν 62% λευκό,
  // τα σκούρα 30% λευκό. Η σχετική φωτεινότητα του τελικού φόντου καθορίζει
  // τη φωτεινή ή σκούρα γραφή, χωρίς υπολογισμό αναλογίας αντίθεσης.
  function tagTones(color) {
    const hex = normalColor(color).slice(1);
    const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const mix = (from, to, share) => from.map((value, i) => Math.round(value * (1 - share) + to[i] * share));
    const toHex = values => '#' + values.map(value => value.toString(16).padStart(2, '0')).join('');
    const light = [255, 255, 255], dark = [0, 0, 0];
    const luminance = values => {
      const [r, g, b] = values.map(value => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const darkTag = luminance(rgb) < 0.18;
    const bg = mix(rgb, light, darkTag ? 0.30 : 0.62);
    const bgLuminance = luminance(bg);
    // Χρησιμοποιούμε το τελικό relative luminance, όχι τη μέγιστη αριθμητική αντίθεση.
    // Το 0.27 κρατά φωτεινή γραφή στο προεπιλεγμένο γκρι των εκπαιδευτικών.
    const lightInk = bgLuminance < 0.27;
    const border = darkTag ? mix(rgb, lightInk ? light : dark, lightInk ? 0.55 : 0.28) : mix(rgb, luminance(rgb) > 0.55 ? dark : light, luminance(rgb) > 0.55 ? 0.18 : 0.26);
    // Σταθερές, συγγενικές αποχρώσεις: απαλά φωτεινά ή σκούρα γράμματα.
    // Η επιλογή βασίζεται μόνο στη σχετική φωτεινότητα, όχι σε αναλογία αντίθεσης.
    const ink = mix(rgb, lightInk ? light : dark, lightInk ? 0.85 : 0.75);
    return {bg: toHex(bg), border: toHex(border), ink: toHex(ink)};
  }

  // Ένα chip: αποχρώσεις του επιλεγμένου χρώματος (χωρίς αλλαγή του αποθηκευμένου χρώματος).
  function tagChip(ref, data) {
    const info = tagsLib().resolve(ref, data);
    const chip = document.createElement('span');
    chip.className = 'school-tag' + (info.missing ? ' is-missing' : '');
    chip.textContent = info.label;
    if (!info.missing) {
      const tones = tagTones(info.color);
      chip.style.setProperty('--school-tag-bg', tones.bg);
      chip.style.setProperty('--school-tag-border', tones.border);
      chip.style.setProperty('--school-tag-ink', tones.ink);
    }
    chip.title = TAG_KIND_TITLES[info.type] + ': ' + (info.missing ? 'δεν βρέθηκε' : info.label);
    return chip;
  }
  // Οι ετικέτες ως chips, με τη σειρά του SchoolTags.sort. Προαιρετικό onRemove(ref):
  // εμφανίζει × σε κάθε chip μόνο όπου η εφαρμογή επιτρέπει αφαίρεση.
  function tagChips(refs, data, {onRemove} = {}) {
    const box = document.createElement('span'); box.className = 'school-tags';
    for (const ref of tagsLib().sort(refs, data)) {
      const chip = tagChip(ref, data);
      if (typeof onRemove === 'function') {
        const label = chip.textContent;
        chip.classList.add('is-removable');
        const text = document.createElement('span'); text.className = 'school-tag-label'; text.textContent = label;
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'school-tag-remove';
        remove.textContent = '×'; remove.title = 'Αφαίρεση ετικέτας: ' + label;
        remove.setAttribute('aria-label', remove.title);
        remove.addEventListener('click', () => onRemove(ref));
        chip.replaceChildren(text, remove);
      }
      box.append(chip);
    }
    return box;
  }

  // Ο επιλογέας ετικετών. options: {title, refs, data, usage(id) → [{one, many, count}], limits:{tags, tagsPerItem, warnRatio}}
  // → {refs, tags} (οι επιλεγμένες ετικέτες, με την κοινή σειρά, και το μητρώο, ίσως αλλαγμένο από τη «Διαχείριση
  // ετικετών…») ή null. Η «Ακύρωση» αναιρεί και τις αλλαγές του μητρώου.
  function tagPick(options = {}) {
    const Tags = tagsLib(), C = window.SchoolClasses, T = window.SchoolTimetable, S = window.SchoolStudents;
    const base = options.data || {};
    let registry = structuredClone(base.tags || {general: [], colors: {}});
    const dataNow = () => ({...base, tags: registry});
    const perItem = Number(options.limits?.tagsPerItem) || 40;
    const keyOf = ref => ref.type + '\u0001' + ref.id;
    const selected = new Map(Tags.clean(options.refs).map(ref => [keyOf(ref), ref]));
    const root = document.createElement('div'); root.className = 'school-tag-picker';
    const search = document.createElement('input'); search.type = 'search'; search.className = 'school-tag-search';
    search.placeholder = 'Αναζήτηση ετικέτας…'; search.setAttribute('aria-label', 'Αναζήτηση ετικέτας');
    const status = document.createElement('p'); status.className = 'school-tag-status'; status.setAttribute('role', 'status');
    const groups = document.createElement('div'); groups.className = 'school-tag-groups';
    root.append(search, status, groups);
    const checkboxes = [];
    let openState = {};
    const refreshLimit = () => {
      const full = selected.size >= perItem;
      for (const box of checkboxes) box.disabled = !box.checked && full;
      status.textContent = 'Επιλεγμένες: ' + selected.size + (full ? ' — έφτασες το όριο των ' + perItem + ' ετικετών ανά στοιχείο.' : '');
      status.classList.toggle('ui-validation-warning', full);
    };
    const item = ref => {
      const label = document.createElement('label'); label.className = 'school-tag-option';
      const box = document.createElement('input'); box.type = 'checkbox'; box.checked = selected.has(keyOf(ref));
      box.onchange = () => { if (box.checked) selected.set(keyOf(ref), ref); else selected.delete(keyOf(ref)); refreshLimit(); };
      const chip = tagChip(ref, dataNow());
      label.dataset.search = tagSearchKey(chip.textContent);
      label.append(box, chip); checkboxes.push(box);
      return label;
    };
    const group = (key, title, refs, nested) => {
      const details = document.createElement('details'); details.className = 'school-tag-group' + (nested ? ' is-nested' : '');
      details.dataset.key = key;
      const summary = document.createElement('summary');
      const list = document.createElement('div'); list.className = 'school-tag-options';
      details.append(summary, list);
      const fill = children => { list.replaceChildren(...children); };
      details.dataset.title = title;
      return {details, summary, list, fill, refs};
    };
    const build = () => {
      checkboxes.length = 0;
      const data = dataNow(), made = [];
      const general = [...(registry.general || [])].filter(tag => tag && tag.id).sort((a, b) => String(a.name).localeCompare(String(b.name), 'el', {sensitivity: 'base', numeric: true}));
      const classes = C.sort(data.classes || []), staff = T.sortStaff(data.staff || []);
      const sections = [
        ['staff', staff.filter(person => person?.id).map(person => ({type: 'staff', id: person.id}))],
        ['class', classes.map(record => ({type: 'class', id: record.id}))]
      ];
      for (const [type, refs] of sections) {
        const g = group(type, TAG_GROUP_TITLES[type], refs);
        g.fill(refs.length ? refs.map(item) : [Object.assign(document.createElement('p'), {className: 'school-tag-empty', textContent: type === 'general' ? 'Δεν υπάρχουν γενικές ετικέτες. Πρόσθεσε από τη «Διαχείριση ετικετών…».' : 'Δεν υπάρχουν.'})]);
        made.push(g);
      }
      // Μαθητές: ανά τμήμα, με τη σειρά των Τμημάτων, και μέσα στο τμήμα με το SchoolStudents.compare.
      const students = (data.students || []).filter(student => student?.id);
      const studentGroup = group('student', TAG_GROUP_TITLES.student, students);
      const byClass = new Map();
      for (const student of students) { if (!byClass.has(student.classId)) byClass.set(student.classId, []); byClass.get(student.classId).push(student); }
      const order = [...classes.map(record => record.id).filter(id => byClass.has(id)), ...[...byClass.keys()].filter(id => !classes.some(record => record.id === id))];
      const nested = order.map(id => {
        const list = byClass.get(id).sort(S.compare), sub = group('student:' + id, C.nameOf(classes, id) || 'Χωρίς τμήμα', list, true);
        sub.fill(list.map(student => item({type: 'student', id: student.id}))); return sub;
      });
      studentGroup.fill(nested.length ? nested.map(sub => sub.details) : [Object.assign(document.createElement('p'), {className: 'school-tag-empty', textContent: 'Δεν υπάρχουν.'})]);
      made.push(studentGroup);
      const generalGroup = group('general', TAG_GROUP_TITLES.general, general);
      const generalRefs = general.map(tag => ({type: 'general', id: tag.id}));
      generalGroup.fill(generalRefs.length ? generalRefs.map(item) : [Object.assign(document.createElement('p'), {className: 'school-tag-empty', textContent: 'Δεν υπάρχουν γενικές ετικέτες. Πρόσθεσε από τη «Διαχείριση ετικετών…».'})]);
      made.push(generalGroup);
      groups.replaceChildren(...made.map(g => g.details));
      for (const g of [...made, ...nested]) {
        const own = g.details.querySelectorAll('input[type=checkbox]');
        g.summary.textContent = g.details.dataset.title + ' (' + own.length + ')';
        const has = [...own].some(box => box.checked);
        g.details.open = g.details.dataset.key in openState ? openState[g.details.dataset.key] : (has || g.details.dataset.key === 'staff');
        g.details.addEventListener('toggle', () => { if (!search.value.trim()) openState[g.details.dataset.key] = g.details.open; });
      }
      filter(); refreshLimit();
    };
    // Αναζήτηση χωρίς τόνους και διάκριση πεζών–κεφαλαίων· οι ομάδες με αποτελέσματα ανοίγουν.
    const filter = () => {
      const query = tagSearchKey(search.value);
      for (const label of groups.querySelectorAll('.school-tag-option')) label.hidden = !!query && !label.dataset.search.includes(query);
      for (const details of [...groups.querySelectorAll('details')].reverse()) {
        const visible = [...details.querySelectorAll('.school-tag-option')].some(label => !label.hidden);
        details.hidden = !!query && !visible;
        if (query) details.open = visible;
        else details.open = details.dataset.key in openState ? openState[details.dataset.key] : ([...details.querySelectorAll('input:checked')].length > 0 || details.dataset.key === 'staff');
      }
    };
    search.addEventListener('input', filter);
    search.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
    return schoolChoiceDialog({
      title: options.title || 'Ετικέτες', content: root, className: 'school-tag-dialog',
      actions: [
        {label: 'Διαχείριση ετικετών…', run: async () => {
          const next = await tagManage({tags: registry, usage: options.usage, limits: options.limits});
          if (next) {
            registry = next;
            const ids = new Set((registry.general || []).map(tag => tag.id));
            for (const [key, ref] of selected) if (ref.type === 'general' && !ids.has(ref.id)) selected.delete(key);
            build();
          }
          search.focus();
          throw tagCancelled();
        }},
        {label: 'Εφαρμογή', accept: true, run: () => ({refs: Tags.sort([...selected.values()], dataNow()), tags: registry})},
        {label: 'Ακύρωση'}
      ],
      ready: () => { build(); search.focus(); }
    });
  }

  // Η «Διαχείριση ετικετών»: γενικές ετικέτες (όνομα, χρώμα, διαγραφή, νέα) και τα χρώματα κατηγορίας.
  // options: {tags, usage(id) → [{one, many, count}], limits:{tags, warnRatio}} → το νέο μητρώο ή null.
  function tagManage(options = {}) {
    const Tags = tagsLib();
    const source = structuredClone(options.tags || {});
    const limit = Number(options.limits?.tags) || 100, warnAt = Math.ceil(limit * (Number(options.limits?.warnRatio) || 0.9));
    const collator = new Intl.Collator('el', {sensitivity: 'base', numeric: true});
    let general = (Array.isArray(source.general) ? source.general : []).filter(tag => tag && tag.id).map(tag => ({...tag})).sort((a, b) => collator.compare(String(a.name), String(b.name)));
    const colors = {...(source.colors && typeof source.colors === 'object' ? source.colors : {})};
    const root = document.createElement('div'); root.className = 'school-tag-manager';
    const generalTitle = document.createElement('h3'); generalTitle.textContent = 'Γενικές ετικέτες';
    const list = document.createElement('div'); list.className = 'school-tag-manager-list';
    const tools = document.createElement('div'); tools.className = 'school-tag-manager-tools';
    const add = document.createElement('button'); add.type = 'button'; add.textContent = '+ Νέα ετικέτα';
    const count = document.createElement('p'); count.className = 'school-tag-manager-count';
    tools.append(add, count);
    const colorsTitle = document.createElement('h3'); colorsTitle.textContent = 'Χρώματα κατηγοριών';
    const colorRows = document.createElement('div'); colorRows.className = 'school-tag-manager-colors';
    root.append(generalTitle, list, tools, colorsTitle, colorRows);
    const swatch = (button, color) => button.querySelector('.school-color-trigger-swatch').style.background = color;
    const trigger = (label, color) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'school-color-trigger';
      button.title = label; button.setAttribute('aria-label', label);
      const span = document.createElement('span'); span.className = 'school-color-trigger-swatch'; button.append(span);
      swatch(button, color); return button;
    };
    const fieldError = () => {
      const keys = new Map();
      let problem = null;
      for (const row of list.children) {
        const input = row.querySelector('input'), name = input.value.trim(), key = Tags.nameKey(name);
        let error = !name ? 'Το όνομα είναι υποχρεωτικό.' : '';
        if (!error && keys.has(key)) error = 'Η ετικέτα «' + name + '» υπάρχει ήδη.';
        if (name) keys.set(key, true);
        input.setAttribute('aria-invalid', String(!!error));
        const message = row.querySelector('.ui-validation-error'); message.textContent = error; message.hidden = !error;
        if (error && !problem) problem = {input, error};
      }
      return problem;
    };
    const refreshCount = () => {
      add.disabled = general.length >= limit;
      count.textContent = general.length >= warnAt ? 'Υπάρχουν ' + general.length + ' από τις ' + limit + ' γενικές ετικέτες του σχολικού έτους.' + (general.length >= limit ? ' Για νέα ετικέτα διάγραψε πρώτα μια που δεν χρειάζεται.' : '') : '';
      count.className = 'school-tag-manager-count' + (general.length >= warnAt ? ' ui-validation-warning' : '');
    };
    const row = tag => {
      const element = document.createElement('div'); element.className = 'school-tag-manager-row';
      const color = trigger('Χρώμα της ετικέτας', tag.color);
      color.onclick = async () => {
        const value = await schoolColorPicker(tag.color, {anchor: color, title: 'Χρώμα ετικέτας'});
        if (value) { tag.color = value; swatch(color, value); }
      };
      const input = document.createElement('input'); input.type = 'text'; input.maxLength = 60; input.value = tag.name || '';
      input.setAttribute('aria-label', 'Όνομα ετικέτας'); input.placeholder = 'Όνομα ετικέτας';
      input.oninput = () => { tag.name = input.value; fieldError(); };
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'school-tag-manager-remove';
      remove.innerHTML = schoolIcon('close'); remove.title = 'Διαγραφή ετικέτας'; remove.setAttribute('aria-label', 'Διαγραφή ετικέτας');
      remove.onclick = async () => {
        const uses = options.usage ? options.usage(tag.id) : [];
        const name = (tag.name || '').trim() || 'χωρίς όνομα';
        if (tagUsageCount(uses) && !await schoolConfirm('Η ετικέτα «' + name + '» υπάρχει σε ' + tagUsageText(uses) + ' και θα αφαιρεθεί από όλες.', {title: 'Διαγραφή ετικέτας', accept: 'Διαγραφή'})) return;
        const index = general.indexOf(tag);
        general = general.filter(item => item !== tag);
        element.remove(); fieldError(); refreshCount();
        const next = list.children[Math.min(index, list.children.length - 1)];
        (next?.querySelector('input') || add).focus();
      };
      const error = document.createElement('p'); error.className = 'ui-validation-error'; error.setAttribute('role', 'alert'); error.hidden = true;
      element.append(color, input, remove, error);
      return element;
    };
    add.onclick = () => {
      if (general.length >= limit) return;
      const tag = {id: crypto.randomUUID(), name: '', color: Tags.NEW_COLOR};
      general.push(tag); const element = row(tag); list.append(element); refreshCount();
      element.querySelector('input').focus();
    };
    const defaults = Tags.DEFAULT_COLORS;
    for (const [key, label] of [['classes', 'Τμήματα'], ['staff', 'Εκπαιδευτικοί'], ['students', 'Μαθητές']]) {
      const line = document.createElement('div'); line.className = 'school-tag-manager-color';
      const name = document.createElement('span'); name.textContent = label;
      const note = document.createElement('span'); note.className = 'ui-helper';
      const effective = () => Tags.validColor(colors[key]) ? colors[key] : defaults[key];
      const button = trigger('Χρώμα ετικετών: ' + label, effective());
      const refresh = () => { swatch(button, effective()); note.textContent = Tags.validColor(colors[key]) ? '' : 'προεπιλογή'; };
      button.onclick = async () => {
        const value = await schoolColorPicker(Tags.validColor(colors[key]) ? colors[key] : '', {anchor: button, title: 'Χρώμα ετικετών: ' + label, defaultColor: true});
        if (value === null) return;
        if (value === '') delete colors[key]; else colors[key] = value;
        refresh();
      };
      refresh();
      line.append(button, name, note); colorRows.append(line);
    }
    list.append(...general.map(row)); refreshCount();
    return schoolChoiceDialog({
      title: 'Διαχείριση ετικετών', content: root, className: 'school-tag-dialog',
      actions: [
        {label: 'Ενημέρωση', accept: true, run: () => {
          const problem = fieldError();
          if (problem) { problem.input.focus(); throw Error(problem.error); }
          return {...source, general: general.map(tag => ({...tag, name: tag.name.trim()})), colors};
        }},
        {label: 'Ακύρωση'}
      ],
      ready: ({dialog}) => {
        dialog.addEventListener('input', () => { const error = dialog.querySelector(':scope > .school-choice-error'); if (error) error.textContent = ''; });
        (list.querySelector('input') || add).focus();
      }
    });
  }
  const schoolTags = Object.freeze({chips: tagChips, chip: tagChip, pick: tagPick, manage: tagManage, usageText: tagUsageText});

  window.schoolMessage = schoolMessage;
  window.schoolConfirm = schoolConfirm;
  window.schoolChoiceDialog = schoolChoiceDialog;
  window.schoolProgramImport = schoolProgramImport;
  window.schoolReplaceProgram = schoolReplaceProgram;
  window.schoolColorPicker = schoolColorPicker;
  window.schoolRichText = schoolRichText;
  window.schoolColor = Object.freeze({normalize: normalColor, ink: inkFor, valid: validColor});
  window.schoolEscape = schoolEscape;
  window.schoolIcon = schoolIcon;
  window.schoolListSelection = schoolListSelection;
  window.schoolHost = schoolHost;
  window.schoolTags = schoolTags;
})();
