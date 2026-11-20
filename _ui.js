/*
 * Εφαρμογές σχολείου — Κοινές λειτουργίες περιβάλλοντος χρήστη
 * Έκδοση αρχείου: 0.50
 * Όνομα κατά την εγκατάσταση: _ui.js
 *
 * Φορτώνεται με <script src="_ui.js"></script> από το Κεντρικό Μενού και από κάθε υποεφαρμογή,
 * πριν από το δικό τους script. Ορίζει:
 *   window.schoolConfirm, window.schoolMessage    διάλογοι ενημέρωσης και επιβεβαίωσης
 *   window.schoolChoiceDialog                      διάλογος με επιλογές και ασύγχρονες ενέργειες
 *   window.schoolProgramImport                     κοινός διάλογος εισαγωγής προγράμματος (ανάλυση → κατασκευή)
 *   window.schoolBackupConfirm                     επιβεβαίωση ενέργειας που αλλάζει τα αποθηκευμένα προγράμματα,
 *                                                  με πρόταση για αντίγραφο ασφαλείας
 *   window.schoolColorPicker, window.schoolColor   επιλογέας χρώματος και βοηθητικά χρώματος
 *   window.schoolRichText                          κείμενο με μορφοποίηση (μπάρα και πεδίο)
 *   window.schoolTags                              ετικέτες: chips, επιλογέας, διαχείριση (χρειάζεται το _data.js)
 *   window.schoolTaggedText                        πλαίσιο κειμένου με μορφοποίηση και ετικέτες (χρειάζεται το _data.js)
 *   window.schoolHost                              επικοινωνία υποεφαρμογής ↔ Κεντρικού Μενού
 *   window.schoolEscape                            ασφαλές κείμενο μέσα σε HTML
 *   window.schoolIcon                              κοινά εικονίδια SVG
 *   window.schoolIconText                          εικονίδιο μαζί με κείμενο, στη μέση των κεφαλαίων
 *   window.schoolListSelection                     πολλαπλή επιλογή σε λίστες (κλικ, Shift, Ctrl, βέλη)
 *   window.schoolMenu                              αναδυόμενο μενού («⋮», «⋯»), ένα τη φορά
 *   window.schoolProblems                          γραμμή και λίστα προβλημάτων μιας περιόδου (συγκρούσεις, προειδοποιήσεις)
 *   window.schoolPeriodSelect                      λίστα περιόδων σε δύο ομάδες, Περίοδοι / Προσχέδια περιόδων
 *                                                  (χρειάζεται το _data_timetable.js)
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
 *   .school-backup-notice, .school-color-picker, .school-richtext-*, .school-tag*, .school-tagged-text*), του μενού στο _ui.css (.ui-menu),
 *   της λίστας προβλημάτων στο _ui.css (.school-problems*), της λίστας περιόδων στο _ui.css (.ui-period-select)
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
        cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = o.cancel;
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
    const o = {title: options.title || 'Ενημέρωση', confirm: !!options.confirm, accept: options.accept || 'Συνέχεια', cancel: options.cancel || 'Ακύρωση'};
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
      // Κάθε αλλαγή σε πεδίο του διαλόγου σβήνει το προηγούμενο μήνυμα λάθους, όσο γράφει ο χρήστης (input) και όχι
      // όταν φεύγει από το πεδίο (change): αλλιώς ένα κλικ σε κουμπί αμέσως μετά τη διόρθωση σβήνει το μήνυμα, το
      // κουμπί ανεβαίνει και το κλικ χάνεται. Τα checkbox, τα radio και τα select στέλνουν κι αυτά input.
      dialog.addEventListener('input', () => { error.textContent = ''; });
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
  //   options.files [{key, label, choose}], choose(): Promise<{name,text}>.
  //   options.initialFiles {key:{name,text}}: only files dropped in this operation.
  //   options.analyze(loaded): analysis of the currently selected files.
  //   options.build(analysis, {unmatched:'keep'|'drop', direct:false}): result.
  //   options.accept: button label (default «Εισαγωγή»).
  // No remembered content is ever loaded on opening; the dialog always confirms import.
  async function schoolProgramImport(options = {}) {
    const loaded = {};
    for (const file of options.files || []) {
      const value = options.initialFiles?.[file.key];
      if (value && typeof value.name === 'string' && typeof value.text === 'string') loaded[file.key] = value;
    }
    return importDialog(options, {loaded, rowErrors: {}, analysis: null, analysisError: ''});
  }
  function importDialog(options, preset) {
    const files = options.files || [], loaded = preset.loaded, rowErrors = preset.rowErrors;
    const fetDrop = files.length === 2 && files.some(file => file.key === 'csv') && files.some(file => file.key === 'fet');
    const oloimeroDrop = files.length === 1 && files[0].key === 'csv' && files[0].label === 'CSV Ολοημέρου';
    const richDrop = fetDrop || oloimeroDrop;
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
    const dropZone = richDrop ? element('div', 'school-import-drop') : null;
    const fileInput = richDrop ? element('input', 'school-import-native') : null;
    let filePickerActive = false, filePickerCancelledAt = 0;
    const pendingNames = {};
    let queuedFiles = [], drainingFiles = false;
    const openFilePicker = () => {
      if (controls?.working) return;
      filePickerActive = true;
      try { fileInput.click(); } catch (problem) { filePickerActive = false; throw problem; }
    };
    const focusImport = () => {
      if (richDrop && analysis?.ok && !controls?.working)
        controls?.dialog.querySelector('.school-confirm-actions .confirm-accept:not(:disabled)')?.focus();
    };
    if (richDrop) {
      dropZone.tabIndex = 0;
      dropZone.setAttribute('role', 'button');
      dropZone.setAttribute('aria-label', fetDrop ? 'Επιλογή αρχείων CSV και FET' : 'Επιλογή CSV Ολοημέρου');
      const icon = element('span', 'subapp-file-drop-icon');
      icon.innerHTML = schoolIcon('file-import');
      const heading = element('strong', 'school-import-drop-title', fetDrop ? 'Σύρε εδώ τα αρχεία CSV και FET' : 'Σύρε εδώ το αρχείο CSV του Ολοημέρου');
      const hint = element('span', 'school-import-drop-hint', fetDrop ? 'ή κάνε κλικ για επιλογή αρχείων' : 'ή κάνε κλικ για επιλογή αρχείου');
      fileInput.type = 'file'; fileInput.accept = fetDrop ? '.csv,.fet' : '.csv'; fileInput.multiple = fetDrop;
      fileInput.tabIndex = -1; fileInput.setAttribute('aria-hidden', 'true');
      dropZone.append(icon, heading, hint, list, fileInput);
      // Keep every drop, including one made while an earlier file is being read or analysed.
      // Show each filename immediately; its ready check appears only after reading succeeds.
      const drainFiles = async () => {
        if (drainingFiles || !controls || controls.working) return;
        drainingFiles = true;
        try {
          while (queuedFiles.length && controls.dialog.open) {
            const selected = queuedFiles.splice(0);
            await controls.busy(async () => {
              for (const file of selected) {
                const key = /\.csv$/i.test(file.name) ? 'csv' : 'fet';
                try {
                  loaded[key] = {name: file.name, text: await file.text()};
                  delete rowErrors[key];
                } catch (problem) {
                  delete loaded[key];
                  rowErrors[key] = problem?.message || String(problem);
                }
                if (pendingNames[key] === file.name) delete pendingNames[key];
                renderFiles();
              }
              await analyzeNow();
            });
          }
        } finally {
          drainingFiles = false;
          focusImport();
        }
      };
      const receive = incoming => {
        const chosen = [...incoming];
        if (!chosen.length) return;
        const valid = chosen.filter(item => (fetDrop ? /\.(csv|fet)$/i : /\.csv$/i).test(item.name));
        if (!valid.length) {
          analysis = null; analysisError = fetDrop ? 'Επίλεξε αρχεία .csv ή .fet.' : 'Επίλεξε αρχείο .csv.';
          renderResult(); return;
        }
        for (const file of valid) {
          pendingNames[/\.csv$/i.test(file.name) ? 'csv' : 'fet'] = file.name;
        }
        analysis = null; analysisError = '';
        queuedFiles.push(...valid);
        renderFiles(); renderResult();
        void drainFiles();
      };
      fileInput.addEventListener('change', () => {
        filePickerActive = false;
        const chosen = [...fileInput.files]; fileInput.value = '';
        void receive(chosen);
      });
      // Chrome can forward the native file picker's Esc to the parent <dialog>.
      // The input's cancel event is distinct from cancelling the import itself.
      fileInput.addEventListener('cancel', () => {
        filePickerActive = false;
        filePickerCancelledAt = Date.now();
      });
      dropZone.addEventListener('click', event => {
        if (event.target === fileInput || controls?.working) return;
        openFilePicker();
      });
      dropZone.addEventListener('keydown', event => {
        if (event.target === dropZone && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault(); openFilePicker();
        }
      });
      dropZone.addEventListener('dragenter', event => {
        if (!event.dataTransfer?.types.includes('Files')) return;
        event.preventDefault(); dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragover', event => {
        if (!event.dataTransfer?.types.includes('Files')) return;
        event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', event => {
        if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove('drag-over');
      });
      dropZone.addEventListener('drop', event => {
        event.preventDefault(); event.stopPropagation(); dropZone.classList.remove('drag-over');
        void receive(event.dataTransfer?.files || []);
      });
    }
    const renderFiles = () => {
      rowButtons = [];
      list.replaceChildren(...files.map(file => {
        const row = element('div', 'school-import-file'), textBox = element('div', 'school-import-file-text');
        const current = pendingNames[file.key] || loaded[file.key]?.name || '';
        textBox.append(element('span', 'school-import-file-label', file.label),
          element('span', 'school-import-file-name', current || 'Δεν έχει επιλεγεί αρχείο'));
        if (rowErrors[file.key]) textBox.append(element('span', 'school-import-file-error', rowErrors[file.key]));
        if (richDrop) {
          const status = element('span', 'school-import-file-state');
          status.innerHTML = schoolIcon(loaded[file.key] && !pendingNames[file.key] ? 'check' : 'file-import');
          status.classList.toggle('is-ready', !!loaded[file.key] && !pendingNames[file.key]);
          row.append(status, textBox);
          return row;
        }
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
        if (!fetDrop) {
          parts.push(section('warning', 'Προειδοποιήσεις', analysis.warnings));
          if (!oloimeroDrop) parts.push(section('info', 'Ενημερωτικά', analysis.info));
        }
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
      className: 'school-import' + (richDrop ? ' school-import-drop-mode' : '') + (fetDrop ? ' school-import-fet' : ''),
      content: [options.intro, richDrop ? dropZone : list, result],
      actions: [
        {label: options.accept || 'Εισαγωγή', accept: true, get disabled() { return !analysis?.ok; },
          run: async () => options.build(analysis, {unmatched: unmatchedBox.querySelector('input:checked')?.value === 'drop' ? 'drop' : 'keep', direct: false})},
        {label: 'Ακύρωση', cancel: true}
      ],
      working: on => { for (const button of rowButtons) button.disabled = on; },
      ready: async api => {
        controls = api; api.refresh();
        if (richDrop) api.dialog.addEventListener('cancel', event => {
          // Capture runs before schoolChoiceDialog's normal Esc handler.
          // Suppress Esc while the native chooser is open and immediately after its cancellation.
          if (!filePickerActive && Date.now() - filePickerCancelledAt >= 500) return;
          event.preventDefault();
          event.stopImmediatePropagation();
        }, {capture: true});
        if (richDrop) api.dialog.addEventListener('keydown', event => {
          if (event.key !== 'Enter' || event.defaultPrevented || event.target === dropZone ||
              event.target.closest('button, textarea') || event.ctrlKey || event.altKey || event.metaKey) return;
          event.preventDefault();
          const accept = api.dialog.querySelector('.school-confirm-actions .confirm-accept');
          if (accept && !accept.disabled) accept.click();
        });
        await api.busy(async () => {
          renderFiles();
          await analyzeNow();
        });
        void drainFiles();
        focusImport();
      }
    });
  }

  // Επιβεβαίωση μιας ενέργειας που αλλάζει ή σβήνει αποθηκευμένα προγράμματα (αντικατάσταση, διαγραφή, επαναφορά),
  // με πρόταση για αντίγραφο ασφαλείας, πάνω στο schoolChoiceDialog. Κάτω από το μήνυμα, πλαίσιο «Προσοχή» με το
  // κουμπί «Αντίγραφο Ασφαλείας…» (.success)· κάτω δεξιά μόνο η αποδοχή («Συνέχεια») και η «Ακύρωση». «Συνέχεια»
  // χωρίς αντίγραφο ρωτά ξανά, σε δεύτερο διάλογο πάνω από τον πρώτο («Ναι» / «Όχι», με την εστίαση στο «Όχι»)· το
  // «Όχι» γυρίζει στον πρώτο διάλογο.
  //   options.title, options.message   τίτλος και κείμενο (κείμενο ή στοιχείο DOM, ή πίνακας από αυτά)
  //   options.accept                  ετικέτα της αποδοχής (προεπιλογή «Συνέχεια»)
  //   options.backup()                Promise με {name} του αρχείου που γράφτηκε (π.χ. το αντίγραφο της περιόδου),
  //                                   ή null όταν ο χρήστης ακύρωσε. Χωρίς backup (δεν υπάρχει κάτι αποθηκευμένο για
  //                                   αντίγραφο) δεν εμφανίζεται πλαίσιο ούτε δεύτερη ερώτηση.
  //   options.note                    κείμενο στο πλαίσιο, κάτω από την προειδοποίηση (π.χ. τι έχει το αντίγραφο)
  // → Promise με true στη «Συνέχεια», false στην ακύρωση.
  async function schoolBackupConfirm(options = {}) {
    const backup = typeof options.backup === 'function' ? options.backup : null;
    let savedName = '', panelButton = null;
    const content = [].concat(options.message ?? []);
    if (backup) {
      const panel = document.createElement('div'); panel.className = 'school-backup-notice';
      const warning = document.createElement('p'), strong = document.createElement('strong');
      strong.textContent = 'Προσοχή:';
      warning.append(strong, ' Αυτή η ενέργεια θα αλλοιώσει τα τρέχοντα δεδομένα. Αν θέλεις, μπορείς να κρατήσεις Αντίγραφο Ασφαλείας.');
      panel.append(warning);
      if (options.note) { const note = document.createElement('p'); note.className = 'school-backup-note'; note.textContent = options.note; panel.append(note); }
      const done = document.createElement('p'); done.className = 'school-backup-done'; done.hidden = true;
      panelButton = document.createElement('button'); panelButton.type = 'button'; panelButton.className = 'success';
      panelButton.textContent = 'Αντίγραφο Ασφαλείας…';
      const row = document.createElement('div'); row.className = 'school-backup-actions'; row.append(panelButton);
      panel.append(done, row);
      content.push(panel);
      panelButton.addEventListener('click', () => controls?.busy(async () => {
        const result = await backup();
        if (!result) return;
        savedName = String(result.name || '');
        done.innerHTML = schoolIconText('check', savedName ? 'Το αντίγραφο αποθηκεύτηκε στο «' + savedName + '».' : 'Το αντίγραφο αποθηκεύτηκε.');
        done.hidden = false;
      }));
    }
    let controls = null, saved = () => !!savedName;
    const value = await schoolChoiceDialog({
      title: options.title || 'Επιβεβαίωση',
      content,
      actions: [
        {label: options.accept || 'Συνέχεια', accept: true, run: async () => {
          if (backup && !saved()) {
            const sure = await schoolConfirm('Είσαι σίγουρος ότι θέλεις να συνεχίσεις χωρίς να κρατήσεις αντίγραφο ασφαλείας;',
              {title: 'Χωρίς αντίγραφο ασφαλείας', accept: 'Ναι', cancel: 'Όχι', queue: true});
            // «Όχι»: back to the first dialog, without a message.
            if (!sure) { const stay = Error('ακυρώθηκε'); stay.name = 'AbortError'; throw stay; }
          }
          return true;
        }},
        {label: 'Ακύρωση', cancel: true}
      ],
      working: on => { if (panelButton) panelButton.disabled = on; },
      ready: api => { controls = api; }
    });
    return value === true;
  }

  // Επιλογέας χρώματος: σταθερή παλέτα και 9 σταθερές θέσεις προσαρμοσμένων χρωμάτων, που ο browser θυμάται.
  // Διπλό κλικ (ή F2) σε θέση ανοίγει τον επιλογέα του browser και αλλάζει το χρώμα της. Ένα αρχικό χρώμα που
  // δεν υπάρχει στην παλέτα ούτε στις θέσεις μένει επιλεγμένο χωρίς να μπει σε θέση (οι θέσεις δεν μετακινούνται).
  // Σύρσιμο: ένα χρώμα της παλέτας, το «Αυτόματο» ή μια θέση, αφημένο πάνω σε θέση της «Προσαρμογής», της δίνει
  // το χρώμα του (η θέση γίνεται η επιλεγμένη)· όσο σέρνεται, ένα δείγμα ακολουθεί τον δείκτη και η θέση από
  // κάτω δείχνει το νέο χρώμα. Esc ή άφημα αλλού: τίποτα δεν αλλάζει.
  // Τίτλος πάνω· κάτω δεξιά «Επιλογή» και, τέρμα δεξιά, «Ακύρωση», όπως σε όλους τους διαλόγους.
  // Επιστρέφει Promise με το χρώμα (#rrggbb) στην «Επιλογή», ή null στην «Ακύρωση»/Esc.
  // Επιλογές:
  //   title, accept   τίτλος και ετικέτα του κουμπιού αποδοχής
  //   anchor          στοιχείο (π.χ. το κουμπί που πατήθηκε): ο επιλογέας ανοίγει κάτω από αυτό, με τη δεξιά
  //                   του άκρη στη δεξιά άκρη του στοιχείου (ή, αν έτσι βγαίνει από τη σελίδα αριστερά, με την
  //                   αριστερή στην αριστερή)· αν δεν χωρά από κάτω, από πάνω· αν δεν χωρά καθόλου, στο κέντρο. Κλικ έξω από τον επιλογέα τον κλείνει όπως η «Ακύρωση». Χωρίς anchor: στο κέντρο.
  //   defaultColor    true ή '#rrggbb': προσθέτει την επιλογή «Αυτόματο» (το προεπιλεγμένο χρώμα)· τότε η τιμή
  //                   μπορεί να είναι και '' (κενό κείμενο) όταν επιλέχθηκε το «Αυτόματο». Με χρώμα, το δείγμα
  //                   του «Αυτόματο» δείχνει αυτό το χρώμα και το σύρσιμο το αντιγράφει· με true, το χρώμα
  //                   κειμένου (--school-ui-text).
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
  // Χρώμα του getComputedStyle («rgb(31, 41, 55)») → #rrggbb, ή κενό.
  const cssHex = value => {
    const parts = String(value ?? '').match(/\d+(\.\d+)?/g);
    return parts && parts.length >= 3 ? '#' + parts.slice(0, 3).map(n => Math.min(255, Math.round(+n)).toString(16).padStart(2, '0')).join('') : '';
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
      const defaultValue = typeof options.defaultColor === 'string' && validColor(options.defaultColor) ? normalColor(options.defaultColor) : '';
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
        if (defaultValue) swatch.style.background = defaultValue;
        const label = document.createElement('span'); label.textContent = 'Αυτόματο';
        auto.append(swatch, label);
        auto.insertAdjacentHTML('beforeend', schoolIcon('check-bold'));
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
        button.innerHTML = schoolIcon('check-bold');
        button.setAttribute('aria-label', customIndex >= 0 ? 'Προσαρμοσμένο χρώμα ' + value + ' (διπλό κλικ ή F2 για αλλαγή)' : 'Χρώμα ' + value);
        if (customIndex >= 0) button.title = 'Διπλό κλικ ή F2 για αλλαγή του χρώματος· σύρε εδώ ένα χρώμα για να το αντιγράψεις';
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

      // Σύρσιμο ενός χρώματος (παλέτα, «Αυτόματο» ή θέση) πάνω σε θέση της «Προσαρμογής». Ξεκινά μετά από 4px,
      // ώστε το κλικ και το διπλό κλικ να μένουν όπως ήταν. Pointer events (όχι drag & drop του HTML): το δείγμα
      // που ακολουθεί τον δείκτη φαίνεται καθαρά και το σύρσιμο δουλεύει και με δάχτυλο.
      const paint = (button, value) => {
        button.style.setProperty('--choice-color', value);
        button.style.setProperty('--choice-ink', inkFor(value));
      };
      const slotIndex = button => [...customList.children].indexOf(button);
      const autoValue = () => {
        if (defaultValue) return defaultValue;
        const swatch = auto?.querySelector('.school-color-picker-auto-swatch');
        return swatch ? cssHex(getComputedStyle(swatch).backgroundColor) : '';
      };
      const dragValue = element => {
        if (element === auto) return autoValue();
        const index = slotIndex(element);
        return index >= 0 ? custom[index] : palette[[...grid.children].indexOf(element)] || '';
      };
      let drag = null, skipClick = false;
      const dropTarget = target => {
        if (drag.target === target) return;
        if (drag.target) { paint(drag.target, custom[slotIndex(drag.target)]); drag.target.classList.remove('school-color-picker-drop'); }
        drag.target = target;
        if (target) { paint(target, drag.value); target.classList.add('school-color-picker-drop'); }
      };
      const endDrag = drop => {
        const current = drag; drag = null;
        if (!current?.started) return;
        const target = current.target, index = target ? slotIndex(target) : -1;
        target?.classList.remove('school-color-picker-drop');
        current.ghost.remove(); dialog.classList.remove('school-color-picker-dragging');
        try { current.source.releasePointerCapture(current.pointerId); } catch {}
        // The click that follows the release must not choose a colour, nor close the picker (outside it).
        skipClick = true; setTimeout(() => { skipClick = false; });
        if (drop && index >= 0) {
          custom[index] = current.value; selected = current.value; customSelectedIndex = index;
          saveCustomColors(); render(); customList.children[index]?.focus();
        } else if (index >= 0) paint(target, custom[index]);
      };
      dialog.addEventListener('pointerdown', event => {
        if (drag?.started || event.button !== 0 || !event.isPrimary) return;
        drag = null;
        const source = event.target.closest?.('.school-color-picker-choice, .school-color-picker-auto');
        if (!source || !dialog.contains(source)) return;
        const value = dragValue(source);
        if (validColor(value)) drag = {source, value: normalColor(value), pointerId: event.pointerId, x: event.clientX, y: event.clientY, started: false, ghost: null, target: null};
      });
      dialog.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (!drag.started) {
          if (!(event.buttons & 1)) { drag = null; return; }
          if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
          drag.started = true;
          // A swatch as big as a slot, in the colour that is dragged.
          const size = customList.firstElementChild.getBoundingClientRect();
          const ghost = document.createElement('div'); ghost.className = 'school-color-picker-drag'; ghost.setAttribute('aria-hidden', 'true');
          ghost.style.width = size.width + 'px'; ghost.style.height = size.height + 'px'; ghost.style.background = drag.value;
          drag.ghost = ghost; dialog.append(ghost); dialog.classList.add('school-color-picker-dragging');
          try { drag.source.setPointerCapture(event.pointerId); } catch {}
        }
        // Under the pointer, but not all of it: the tip of the pointer sits a little inside its top left corner.
        drag.ghost.style.left = (event.clientX - 12) + 'px';
        drag.ghost.style.top = (event.clientY - 10) + 'px';
        const under = document.elementFromPoint(event.clientX, event.clientY)?.closest('.school-color-picker-choice');
        dropTarget(under && under.parentNode === customList ? under : null);
      });
      dialog.addEventListener('pointerup', event => { if (drag && event.pointerId === drag.pointerId) endDrag(true); });
      dialog.addEventListener('pointercancel', event => { if (drag && event.pointerId === drag.pointerId) endDrag(false); });
      dialog.addEventListener('click', event => {
        if (!skipClick) return;
        skipClick = false; event.preventDefault(); event.stopImmediatePropagation();
      }, true);
      // Esc while dragging cancels only the dragging, not the picker.
      dialog.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !drag?.started) return;
        event.preventDefault(); event.stopPropagation(); endDrag(false);
      }, true);
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
      dialog.addEventListener('cancel', event => { event.preventDefault(); if (drag?.started) endDrag(false); else dialog.close(); });
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

  // Κοινά εικονίδια (24×24, χρώμα από το currentColor). Το μέγεθος το δίνει το CSS του κουμπιού, από την κλίμακα
  // --school-ui-icon-size* του _ui.css (π.χ. .ui-icon-button). Τα σύμβολα των κουμπιών είναι πάντα από εδώ, όχι χαρακτήρες.
  // schoolIcon(name) επιστρέφει το SVG ως κείμενο· ένα στοιχείο με data-school-icon="name" και χωρίς
  // περιεχόμενο στη σελίδα το παίρνει αυτόματα κατά τη φόρτωση.
  // Εικονίδιο μαζί με κείμενο (π.χ. «Προσθήκη» με «+»): schoolIconText(name, text, {end}) επιστρέφει το HTML
  // <span class="ui-icon-text"><svg/><span>κείμενο</span></span> (end:true: το εικονίδιο μετά το κείμενο). Το
  // .ui-icon-text του _ui.css βάζει το κέντρο του εικονιδίου στη μέση των κεφαλαίων, με οποιαδήποτε γραμματοσειρά,
  // χωρίς να αλλάζει η γραμμή βάσης του κειμένου. Ένα στοιχείο με data-school-icon="name" (ή data-school-icon-end)
  // και με κείμενο παίρνει την ίδια μορφή αυτόματα κατά τη φόρτωση.
  const icons = {
    up: ['2.6', 'M12 20V4m-7 7 7-7 7 7'],
    down: ['2.6', 'M12 4v16m-7-7 7 7 7-7'],
    import: ['2.4', 'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5'],
    export: ['2.4', 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5'],
    menu: ['2.2', 'M4 6h16M4 12h16M4 18h16'],
    edit: ['2.2', 'M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20zM14.5 7.5l3 3'],
    close: ['2.2', 'M6 6l12 12M18 6 6 18'],
    minus: ['2.2', 'M6.5 12h11'],
    plus: ['2.2', 'M12 5v14M5 12h14'],
    copy: ['2', 'M9 8h10a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM16 8V4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3'],
    // Μορφοποίηση κειμένου (schoolRichText).
    bold: ['3.3', 'M7 4h5.5a4 4 0 0 1 0 8H7zM7 12h6.5a4 4 0 0 1 0 8H7z'],
    italic: ['2', 'M10 4h8M6 20h8M15 4 9 20'],
    underline: ['2', 'M5.5 4v9.5a6.5 6.5 0 0 0 13 0V4M4 23.5h16'],
    'text-color': ['2', 'M5.5 20 12 4l6.5 16M7.9 14h8.2'],
    'chevron-down': ['2.4', 'm6 9 6 6 6-6'],
    'bullet-list': ['2', 'M10 6h10M10 12h10M10 18h10M4.5 5.2a.8.8 0 1 0 0 1.6.8.8 0 1 0 0-1.6zM4.5 11.2a.8.8 0 1 0 0 1.6.8.8 0 1 0 0-1.6zM4.5 17.2a.8.8 0 1 0 0 1.6.8.8 0 1 0 0-1.6z'],
    'number-list': ['1.8', 'M10 6h10M10 12h10M10 18h10M3.6 4.4 5 3.5v5M3.4 8.5h3.2M3.5 15a1.6 1.6 0 0 1 3.1.3c0 .9-.8 1.4-3.1 3.2h3.2'],
    'clear-format': ['2', 'M5 5h11M10.5 5 8 18M14 14l6 6M20 14l-6 6'],
    // Κατάσταση και ενδείξεις.
    // Two check marks: check (the ordinary one, next to text and in lists) and check-bold (larger and heavier,
    // where it must stand out on any colour, e.g. the selected colour of schoolColorPicker).
    check: ['3.4', 'M4.5 12.5l5 5L19.5 7'],
    'check-bold': ['4.2', 'M4 12.8l5.2 5.2L20 6.5'],
    clock: ['2.2', 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 1 0 0-17zM12 7.5V12l3 2'],
    // Two exclamation marks, like the check marks: alert (next to ordinary text) and alert-bold (next to bold text
    // or on coloured cards, e.g. the hours of the Ολοήμερο Designer).
    alert: ['3.4', 'M12 3.5v11M12 19.5v.01'],
    'alert-bold': ['4.6', 'M12 2.3v11.9M12 21.6v.01'],
    warning: ['2.2', 'M12 3.5 2.5 20h19zM12 10v4.5M12 17.2v.01'],
    // Κίνηση, σειρά, αναίρεση.
    'chevron-left': ['2.4', 'm15 6-6 6 6 6'],
    'chevron-right': ['2.4', 'm9 6 6 6-6 6'],
    'arrow-left': ['2.2', 'M20 12H4m6-6-6 6 6 6'],
    'arrow-right': ['2.2', 'M4 12h16m-6-6 6 6-6 6'],
    undo: ['2.2', 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
    redo: ['2.2', 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
    grip: ['3.2', 'M9 4.5v.01M15 4.5v.01M9 9.5v.01M15 9.5v.01M9 14.5v.01M15 14.5v.01M9 19.5v.01M15 19.5v.01'],
    // Αρχεία και προβολές.
    'file-import': ['2', 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6m-3-3 3 3 3-3'],
    'calendar-month': ['2', 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3M14 18h3'],
    'calendar-year': ['2', 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 9h18M8 9v12M13 9v12M18 9v12M3 13h18M3 17h18'],
    // The two groups of the period lists (schoolPeriodSelect): an Επίσημη περίοδος (a calendar with a check mark, it is
    // in force) and a Προσχέδιο περιόδου (a dashed calendar, like the dashed «Προσχέδιο περιόδου» status: no dates yet).
    'calendar-check': ['2', 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM7 3v4M17 3v4M3 10h18M8.5 15.2l2.5 2.5 4.6-4.6'],
    'calendar-dashed': ['2', 'M3 8V7a2 2 0 0 1 2-2h1M10 5h4M18 5h1a2 2 0 0 1 2 2v1M21 12.5v3M21 18v1a2 2 0 0 1-2 2h-1M10 21h4M6 21H5a2 2 0 0 1-2-2v-1M3 12.5v3M7 3v4M17 3v4M3 10h18'],
    // Sections of a day (e.g. the indicators of the Σχολικό Ημερολόγιο). Small icons (12–16px), so a heavier stroke.
    note: ['2.4', 'M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 3v4h4M8.5 12h7M8.5 16h5'],
    book: ['2.4', 'M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5V20'],
    scale: ['2.4', 'M12 4v16M8.5 20h7M5 7h14M5 7 2.5 13a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z'],
    meeting: ['2.4', 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a5 5 0 0 1 3.5 4.8v1'],
    // Menus (schoolMenu): «⋮» for the actions of an item (e.g. a card) and «⋯» for the rarer actions of a page.
    'more-vertical': ['3.6', 'M12 5v.01M12 12v.01M12 19v.01'],
    'more-horizontal': ['3.6', 'M5 12h.01M12 12h.01M19 12h.01']
  };
  function schoolIcon(name) {
    const icon = icons[name];
    if (!icon) return '';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${icon[0]}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${icon[1]}"/></svg>`;
  }
  function schoolIconText(name, text, {end = false} = {}) {
    const label = `<span>${schoolEscape(text)}</span>`;
    return `<span class="ui-icon-text">${end ? label + schoolIcon(name) : schoolIcon(name) + label}</span>`;
  }
  // Λίστα περιόδων: ένα υπάρχον <select> γεμίζει με δύο ομάδες, «Περίοδοι» (οι Επίσημες) και «Προσχέδια περιόδων»,
  // με τη σειρά του SchoolTimetable.sortPeriods και τον αριθμό της περιόδου μέσα στην ομάδα της (periodNumbers).
  //   schoolPeriodSelect(select, periods, {note, value, year, selected, empty, fit})
  //     note(period)   η σημείωση της εφαρμογής μετά τις ημερομηνίες (π.χ. «(κενή)»), ή κενό· μόνο στην ανοιχτή λίστα
  //     value(period)  η τιμή της γραμμής (προεπιλογή: το id της περιόδου)
  //     year           το σχολικό έτος, για το κενό «Έως» (τέλος του έτους, SchoolTimetable.periodEnd)
  //     selected       η τιμή που επιλέγεται (προεπιλογή: η τρέχουσα τιμή, όταν υπάρχει ακόμη)
  //     empty          το κείμενο όταν δεν υπάρχει καμία περίοδος (προεπιλογή «Δεν υπάρχουν περίοδοι»)
  //     fit            true: η κλειστή λίστα δείχνει ολόκληρο το όνομα και παίρνει το πλάτος της περιόδου που φαίνεται
  //                    (μεγαλώνει και μικραίνει με την επιλογή, π.χ. στη γραμμή περιόδου των Σχολικών Προγραμμάτων)
  // Ανοιχτή λίστα: «1. Όνομα · 14/09/2026 – 25/09/2026 · (σημείωση)»· ένα Προσχέδιο περιόδου δεν έχει ημερομηνίες.
  // Κλειστή λίστα: «1. Όνομα» (το όνομα έως PERIOD_NAME_LIMIT χαρακτήρες και «…») και δεξιά, δίπλα στο βελάκι, η
  // ένδειξη «Επίσημη περίοδος» / «Προσχέδιο περιόδου» (.ui-period-status). Το tooltip έχει ολόκληρο το όνομα και, σε
  // Επίσημη, τις ημερομηνίες. Το πλάτος της κλειστής λίστας είναι του μεγαλύτερου ζεύγους «όνομα + ένδειξη» των
  // περιόδων της λίστας (--ui-period-select-width), ώστε να μην αλλάζει με την επιλογή· μια σελίδα που δίνει δικό της
  // πλάτος (π.χ. width:100% σε διάλογο) κρατά το δικό της. Μια ομάδα χωρίς περιόδους δεν φαίνεται.
  // Η εμφάνιση (.ui-period-select, με appearance:base-select) είναι στο _ui.css· σε Chrome χωρίς base-select (πριν
  // από το 135) η λίστα είναι απλή, όπως πριν (χωρίς ένδειξη και χωρίς σύντομο όνομα), και δουλεύει κανονικά.
  const PERIOD_NAME_LIMIT = 20;
  const periodSelectCustom = (() => { try { return CSS.supports('appearance', 'base-select'); } catch { return false; } })();
  const periodSelectTitles = new WeakMap();
  function periodSelectTitle(select) {
    select.title = periodSelectTitles.get(select)?.get(select.value) || '';
  }
  // The width of the closed list: the widest «1. Όνομα» with its status, measured with the font of the list, plus
  // the padding and the border of the list (they hold the arrow). A list that is hidden is measured too.
  function periodSelectMeasure(select) {
    const options = [...select.querySelectorAll('option')].filter(option => option.querySelector('.ui-period-select-short'));
    if (!options.length) { select.style.removeProperty('--ui-period-select-width'); return; }
    const style = getComputedStyle(select);
    const probe = document.createElement('span');
    probe.className = 'ui-period-select-probe';
    probe.style.font = style.font;
    probe.style.letterSpacing = style.letterSpacing;
    (document.body || document.documentElement).append(probe);
    let widest = 0;
    for (const option of options) {
      const row = document.createElement('span');
      row.className = 'ui-period-select-closed';
      row.append(option.querySelector('.ui-period-select-short').cloneNode(true), option.querySelector('.ui-period-status').cloneNode(true));
      probe.append(row);
      widest = Math.max(widest, row.getBoundingClientRect().width);
    }
    probe.remove();
    const px = name => parseFloat(style[name]) || 0;
    const extra = px('paddingLeft') + px('paddingRight') + px('borderLeftWidth') + px('borderRightWidth');
    select.style.setProperty('--ui-period-select-width', Math.ceil(widest + extra + 1) + 'px');
  }
  function schoolPeriodSelect(select, periods, {note, value, year, selected, empty = 'Δεν υπάρχουν περίοδοι', fit = false} = {}) {
    const T = window.SchoolTimetable, D = window.SchoolDate;
    if (!T || !D) throw new Error('Λείπει το _data_timetable.js.');
    const previous = selected !== undefined ? selected : select.value;
    const list = T.sortPeriods(periods || []), numbers = T.periodNumbers(list);
    const make = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    };
    const titles = new Map();
    const button = make('button');
    button.type = 'button';
    button.append(document.createElement('selectedcontent'));
    const children = [button];
    for (const [draft, label, icon] of [[false, 'Περίοδοι', 'calendar-check'], [true, 'Προσχέδια περιόδων', 'calendar-dashed']]) {
      const items = list.filter(period => T.isDraftPeriod(period) === draft);
      if (!items.length) continue;
      const group = make('optgroup', draft ? 'draft' : 'official');
      group.label = label;
      const legend = make('legend');
      legend.innerHTML = schoolIcon(icon);
      legend.append(make('span', '', label));
      group.append(legend);
      for (const period of items) {
        const option = make('option');
        option.value = value ? String(value(period)) : period.id;
        const number = numbers.get(period.id) + '. ', name = String(period.name || '').trim() || 'Χωρίς όνομα';
        const dates = !draft && D.valid(period.from) ? D.format(period.from) + ' – ' + D.format(T.periodEnd(period, year)) : '';
        option.append(make('span', 'ui-period-select-name', number + name));
        if (dates) option.append(make('span', 'ui-period-select-dates', ' · ' + dates));
        const extra = note ? String(note(period) || '').trim() : '';
        if (extra) option.append(make('span', 'ui-period-select-note', ' · ' + extra));
        if (periodSelectCustom) {
          const short = !fit && name.length > PERIOD_NAME_LIMIT ? name.slice(0, PERIOD_NAME_LIMIT).trimEnd() + '…' : name;
          option.append(make('span', 'ui-period-select-short', number + short),
            make('span', 'ui-period-status ' + (draft ? 'draft' : 'official'), draft ? 'Προσχέδιο περιόδου' : 'Επίσημη περίοδος'));
        }
        titles.set(option.value, number + name + (dates ? ' · ' + dates : ''));
        group.append(option);
      }
      children.push(group);
    }
    if (children.length === 1) {
      const option = make('option', '', empty);
      option.value = '';
      children.push(option);
    }
    select.classList.add('ui-period-select');
    select.replaceChildren(...children);
    select.value = [...select.options].some(option => option.value === previous) ? previous : '';
    if (select.selectedIndex < 0 && select.options.length) select.selectedIndex = 0;
    // The tooltip follows the selected period, also when the application sets the value itself (e.g. back to the
    // previous period after «Ακύρωση»): it is read again when the pointer or the focus comes to the list.
    if (!periodSelectTitles.has(select)) for (const type of ['change', 'pointerenter', 'focus']) select.addEventListener(type, () => periodSelectTitle(select));
    periodSelectTitles.set(select, titles);
    periodSelectTitle(select);
    // With fit the list has the width of the period it shows (no measured width).
    if (periodSelectCustom && fit) select.style.removeProperty('--ui-period-select-width');
    else if (periodSelectCustom) {
      periodSelectMeasure(select);
      // Measured again once the fonts are loaded, so the width follows the font the list is drawn with.
      document.fonts?.ready?.then(() => { if (select.isConnected) periodSelectMeasure(select); });
    }
    return select;
  }
  for (const element of document.querySelectorAll('[data-school-icon],[data-school-icon-end]')) {
    if (element.firstElementChild) continue;
    const text = element.textContent.trim();
    const end = !element.dataset.schoolIcon;
    const name = end ? element.dataset.schoolIconEnd : element.dataset.schoolIcon;
    if (text) element.innerHTML = schoolIconText(name, text, {end});
    else element.insertAdjacentHTML('afterbegin', schoolIcon(name));
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

  // Το αρχικό χρώμα αποθηκεύεται ανέπαφο· οι αποχρώσεις υπολογίζονται μόνο στην εμφάνιση.
  // Όλα τα chips έχουν απαλό φόντο και σκούρα γράμματα από το ίδιο χρώμα.
  // Φωτεινά χρώματα: φόντο με 62% λευκό, γράμματα με 75% μαύρο.
  // Σκούρα χρώματα (relative luminance < 0.18): φόντο με 82% λευκό, περίγραμμα το ίδιο
  // το χρώμα, γράμματα με 55% μαύρο. Αν η αντίθεση είναι κάτω από 7:1, το μαύρο ανεβαίνει
  // έως 80% (ώστε τα γράμματα να κρατούν πάντα κάτι από το χρώμα) και μετά ανοίγει το
  // φόντο έως 95% λευκό.
  const TAG_DARK_LUMINANCE = 0.18;
  const TAG_DARK_MIN_CONTRAST = 7;
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
    const contrast = (a, b) => {
      const la = luminance(a), lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const tagLuminance = luminance(rgb);
    if (tagLuminance >= TAG_DARK_LUMINANCE) {
      const bg = mix(rgb, light, 0.62);
      const border = mix(rgb, tagLuminance > 0.55 ? dark : light, tagLuminance > 0.55 ? 0.18 : 0.26);
      const ink = mix(rgb, dark, 0.75);
      return {bg: toHex(bg), border: toHex(border), ink: toHex(ink)};
    }
    // Ακέραια ποσοστά, ώστε τα βήματα να είναι ακριβή.
    let white = 82, black = 55;
    let bg = mix(rgb, light, white / 100), ink = mix(rgb, dark, black / 100);
    while (contrast(bg, ink) < TAG_DARK_MIN_CONTRAST && black < 80) {
      black += 5;
      ink = mix(rgb, dark, black / 100);
    }
    while (contrast(bg, ink) < TAG_DARK_MIN_CONTRAST && white < 95) {
      white += 1;
      bg = mix(rgb, light, white / 100);
    }
    return {bg: toHex(bg), border: toHex(rgb), ink: toHex(ink)};
  }

  // Ένα chip: αποχρώσεις του επιλεγμένου χρώματος (χωρίς αλλαγή του αποθηκευμένου χρώματος).
  function tagChip(ref, data) {
    const info = tagsLib().resolve(ref, data);
    const chip = document.createElement('span');
    chip.className = 'school-tag' + (info.missing ? ' is-missing' : '') + (['student', 'staff', 'class'].includes(info.type) ? ' school-tag-' + info.type : '');
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
        remove.innerHTML = schoolIcon('close'); remove.title = 'Αφαίρεση ετικέτας: ' + label;
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
  // Ο ίδιος διάλογος διαλέγει και μαθητές, τμήματα ή εκπαιδευτικούς για άλλη χρήση (π.χ. συμμετέχοντες σε συμβάν), με:
  //   types      οι κατηγορίες που φαίνονται, π.χ. ['student'] (προεπιλογή: όλες)
  //   exclude    αναφορές που δεν προσφέρονται (π.χ. όσοι είναι ήδη συμμετέχοντες)
  //   manage     false: χωρίς «Διαχείριση ετικετών…»
  //   accept     η ετικέτα του κύριου κουμπιού (προεπιλογή «Εφαρμογή»)
  //   max        το όριο των επιλεγμένων (προεπιλογή limits.tagsPerItem)
  //   texts      {search, selected, limit}: το κείμενο της αναζήτησης, «Επιλεγμένες» και το όριο στο μήνυμα
  //              («ετικετών ανά στοιχείο»)
  //   selectAll  true: κάθε ομάδα με επιλογές (π.χ. οι μαθητές ενός τμήματος) έχει «Επιλογή όλων» / «Καμία επιλογή»
  function tagPick(options = {}) {
    const Tags = tagsLib(), C = window.SchoolClasses, T = window.SchoolTimetable, S = window.SchoolStudents;
    const base = options.data || {};
    let registry = structuredClone(base.tags || {general: [], colors: {}});
    const dataNow = () => ({...base, tags: registry});
    const perItem = Number(options.max) || Number(options.limits?.tagsPerItem) || 40;
    const texts = {search: 'Αναζήτηση ετικέτας…', selected: 'Επιλεγμένες', limit: 'ετικετών ανά στοιχείο', ...(options.texts || {})};
    const allTypes = ['staff', 'class', 'student', 'general'];
    const types = Array.isArray(options.types) && options.types.length ? allTypes.filter(type => options.types.includes(type)) : allTypes;
    const openByDefault = types[0];
    const keyOf = ref => ref.type + '\u0001' + ref.id;
    const excluded = new Set((Array.isArray(options.exclude) ? options.exclude : []).filter(ref => ref && ref.type && ref.id).map(keyOf));
    const offered = ref => !excluded.has(keyOf(ref));
    const selected = new Map(Tags.clean(options.refs).map(ref => [keyOf(ref), ref]));
    const root = document.createElement('div'); root.className = 'school-tag-picker';
    const search = document.createElement('input'); search.type = 'search'; search.className = 'school-tag-search';
    search.placeholder = texts.search; search.setAttribute('aria-label', texts.search.replace(/…$/, ''));
    const status = document.createElement('p'); status.className = 'school-tag-status'; status.setAttribute('role', 'status');
    const groups = document.createElement('div'); groups.className = 'school-tag-groups';
    root.append(search, status, groups);
    const checkboxes = [], allButtons = [];
    let openState = {};
    const refreshLimit = () => {
      const full = selected.size >= perItem;
      for (const box of checkboxes) box.disabled = !box.checked && full;
      status.textContent = texts.selected + ': ' + selected.size + (full ? ' — έφτασες το όριο των ' + perItem + ' ' + texts.limit + '.' : '');
      status.classList.toggle('ui-validation-warning', full);
      for (const refresh of allButtons) refresh();
    };
    const item = ref => {
      const label = document.createElement('label'); label.className = 'school-tag-option';
      const box = document.createElement('input'); box.type = 'checkbox'; box.checked = selected.has(keyOf(ref));
      box.onchange = () => { if (box.checked) selected.set(keyOf(ref), ref); else selected.delete(keyOf(ref)); refreshLimit(); };
      box.ref = ref;
      const chip = tagChip(ref, dataNow());
      label.dataset.search = tagSearchKey(chip.textContent);
      label.append(box, chip); checkboxes.push(box);
      return label;
    };
    // «Επιλογή όλων» of a group: the visible options of the group (also after a search), up to the limit;
    // when they are all selected, «Καμία επιλογή» clears them.
    const selectAllButton = list => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'ui-compact-button school-tag-select-all';
      const own = () => [...list.querySelectorAll(':scope > .school-tag-option:not([hidden]) input[type=checkbox]')];
      const refresh = () => {
        const boxes = own(), all = boxes.length > 0 && boxes.every(box => box.checked);
        button.textContent = all ? 'Καμία επιλογή' : 'Επιλογή όλων';
        button.disabled = !boxes.length || (!all && selected.size >= perItem);
      };
      button.addEventListener('click', () => {
        const boxes = own(), all = boxes.every(box => box.checked);
        for (const box of boxes) {
          if (all) { box.checked = false; selected.delete(keyOf(box.ref)); }
          else if (!box.checked && selected.size < perItem) { box.checked = true; selected.set(keyOf(box.ref), box.ref); }
        }
        refreshLimit();
      });
      allButtons.push(refresh);
      return button;
    };
    const group = (key, title, refs, nested) => {
      const details = document.createElement('details'); details.className = 'school-tag-group' + (nested ? ' is-nested' : '');
      details.dataset.key = key;
      const summary = document.createElement('summary');
      const list = document.createElement('div'); list.className = 'school-tag-options';
      details.append(summary, list);
      const fill = children => {
        const hasOptions = children.some(child => child.classList?.contains('school-tag-option'));
        list.replaceChildren(...(options.selectAll && hasOptions ? [selectAllButton(list)] : []), ...children);
      };
      details.dataset.title = title;
      return {details, summary, list, fill, refs};
    };
    const empty = text => Object.assign(document.createElement('p'), {className: 'school-tag-empty', textContent: text});
    const build = () => {
      checkboxes.length = 0; allButtons.length = 0;
      const data = dataNow(), made = [];
      let nested = [];
      const classes = C.sort(data.classes || []);
      for (const type of types) {
        if (type === 'staff' || type === 'class') {
          const refs = type === 'staff'
            ? T.sortStaffAlphabetically(data.staff || []).filter(person => person?.id).map(person => ({type: 'staff', id: person.id})).filter(offered)
            : classes.map(record => ({type: 'class', id: record.id})).filter(offered);
          const g = group(type, TAG_GROUP_TITLES[type], refs);
          g.fill(refs.length ? refs.map(item) : [empty('Δεν υπάρχουν.')]);
          made.push(g);
        } else if (type === 'student') {
          // Μαθητές: ανά τμήμα, με τη σειρά των Τμημάτων, και μέσα στο τμήμα με το SchoolStudents.compare.
          const students = (data.students || []).filter(student => student?.id && offered({type: 'student', id: student.id}));
          const studentGroup = group('student', TAG_GROUP_TITLES.student, students);
          const byClass = new Map();
          for (const student of students) { if (!byClass.has(student.classId)) byClass.set(student.classId, []); byClass.get(student.classId).push(student); }
          const order = [...classes.map(record => record.id).filter(id => byClass.has(id)), ...[...byClass.keys()].filter(id => !classes.some(record => record.id === id))];
          nested = order.map(id => {
            const list = byClass.get(id).sort(S.compare), sub = group('student:' + id, C.nameOf(classes, id) || 'Χωρίς τμήμα', list, true);
            sub.fill(list.map(student => item({type: 'student', id: student.id}))); return sub;
          });
          studentGroup.fill(nested.length ? nested.map(sub => sub.details) : [empty('Δεν υπάρχουν.')]);
          made.push(studentGroup);
        } else {
          const general = [...(registry.general || [])].filter(tag => tag && tag.id).sort((a, b) => String(a.name).localeCompare(String(b.name), 'el', {sensitivity: 'base', numeric: true}));
          const generalRefs = general.map(tag => ({type: 'general', id: tag.id})).filter(offered);
          const generalGroup = group('general', TAG_GROUP_TITLES.general, generalRefs);
          generalGroup.fill(generalRefs.length ? generalRefs.map(item) : [empty(options.manage === false ? 'Δεν υπάρχουν.' : 'Δεν υπάρχουν γενικές ετικέτες. Πρόσθεσε από τη «Διαχείριση ετικετών…».')]);
          made.push(generalGroup);
        }
      }
      groups.replaceChildren(...made.map(g => g.details));
      for (const g of [...made, ...nested]) {
        const own = g.details.querySelectorAll('input[type=checkbox]');
        g.summary.textContent = g.details.dataset.title + ' (' + own.length + ')';
        const has = [...own].some(box => box.checked);
        g.details.open = g.details.dataset.key in openState ? openState[g.details.dataset.key] : (has || g.details.dataset.key === openByDefault);
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
        else details.open = details.dataset.key in openState ? openState[details.dataset.key] : ([...details.querySelectorAll('input:checked')].length > 0 || details.dataset.key === openByDefault);
      }
      for (const refresh of allButtons) refresh();
    };
    search.addEventListener('input', filter);
    search.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
    return schoolChoiceDialog({
      title: options.title || 'Ετικέτες', content: root, className: 'school-tag-dialog',
      actions: [
        ...(options.manage === false ? [] : [{label: 'Διαχείριση ετικετών…', run: async () => {
          const next = await tagManage({tags: registry, usage: options.usage, limits: options.limits});
          if (next) {
            registry = next;
            const ids = new Set((registry.general || []).map(tag => tag.id));
            for (const [key, ref] of selected) if (ref.type === 'general' && !ids.has(ref.id)) selected.delete(key);
            build();
          }
          search.focus();
          throw tagCancelled();
        }}]),
        {label: options.accept || 'Εφαρμογή', accept: true, run: () => ({refs: Tags.sort([...selected.values()], dataNow()), tags: registry})},
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
    const add = document.createElement('button'); add.type = 'button'; add.innerHTML = schoolIconText('plus', 'Νέα ετικέτα');
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
    for (const [key, label] of [['staff', 'Εκπαιδευτικοί'], ['classes', 'Τμήματα'], ['students', 'Μαθητές']]) {
      const line = document.createElement('div'); line.className = 'school-tag-manager-color';
      const name = document.createElement('span'); name.textContent = label;
      const note = document.createElement('span'); note.className = 'ui-helper';
      const effective = () => Tags.validColor(colors[key]) ? colors[key] : defaults[key];
      const button = trigger('Χρώμα ετικετών: ' + label, effective());
      const refresh = () => { swatch(button, effective()); note.textContent = Tags.validColor(colors[key]) ? '' : 'προεπιλογή'; };
      button.onclick = async () => {
        const value = await schoolColorPicker(Tags.validColor(colors[key]) ? colors[key] : '', {anchor: button, title: 'Χρώμα ετικετών: ' + label, defaultColor: defaults[key]});
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
      ready: () => {
        (list.querySelector('input') || add).focus();
      }
    });
  }
  const schoolTags = Object.freeze({chips: tagChips, chip: tagChip, pick: tagPick, manage: tagManage, usageText: tagUsageText});

  // ---- Κείμενο με μορφοποίηση και ετικέτες (window.schoolTaggedText) ----
  // Ένα πλαίσιο με μορφοποιημένο κείμενο και ετικέτες, που αλλάζει μέσα στη θέση του. Προβολή: το κείμενο (ή το
  // emptyText), από κάτω οι ετικέτες ως chips και δεξιά το μολυβάκι και, όταν υπάρχει κείμενο, το «×». Επεξεργασία:
  // schoolRichText με «Αποδοχή» / «Ακύρωση» στη μπάρα και από κάτω η γραμμή ετικετών (chips με «×», «Χωρίς ετικέτες»,
  // «Ετικέτες…» με τον επιλογέα και τη «Διαχείριση ετικετών…»). Χρειάζεται το _data.js.
  //   schoolTaggedText.create(options) → {element, value, editing, edit(focus), commit(), cancel(), refresh(), focus()}
  //     value        {html, tags}: η αρχική τιμή
  //     editing      true: ανοίγει κατευθείαν σε επεξεργασία (π.χ. νέα σημείωση)
  //     label        aria-label του πεδίου· color: το αρχικό χρώμα του «A» (schoolRichText)
  //     texts        {empty, edit, create, remove, accept, cancel, removeConfirm, removeTitle, pickTitle}
  //     tags         {data() → {tags, classes, staff, students}, usage(id, current) → [{one, many, count}],
  //                  limits, onRegistry(registry, removedIds)}: το μητρώο του διαλόγου το κρατά η εφαρμογή· current
  //                  είναι η ανοιχτή τιμή {html, tags}, για να μετρηθεί στη χρήση
  //     tools        true (προεπιλογή): φαίνονται το μολυβάκι και το «×»· locked() → true: ανενεργά (π.χ. όσο
  //                  αλλάζει άλλο στοιχείο)
  //     before       στοιχείο μπροστά από το κείμενο στην προβολή (π.χ. λαβή μετακίνησης)
  //     aside        στοιχείο της εφαρμογής σε στήλη δεξιά από το κείμενο (π.χ. βαθμολογία), σε προβολή και σε
  //                  επεξεργασία· στην προβολή το μολυβάκι και το «×» μπαίνουν πάνω δεξιά στη στήλη, και η στήλη
  //                  δίνει τον χώρο τους στο --school-tagged-text-tools-width (κενό δεξιά στην πρώτη γραμμή του
  //                  aside)· στην επεξεργασία τα «Αποδοχή» / «Ακύρωση» μπαίνουν πάνω από αυτό, όχι στη μπάρα.
  //                  Το περιεχόμενό του το γράφει η εφαρμογή (π.χ. στο onEditing)· σε στενή οθόνη πάει κάτω από το κείμενο
  //     validate(value) πριν από την «Αποδοχή» (και το commit()), με την ανοιχτή τιμή {html, tags}: true ή τίποτα,
  //                  συνεχίζει· κείμενο: μήνυμα λάθους κάτω από το πεδίο και εστίαση σε αυτό· false: δεν συνεχίζει,
  //                  χωρίς μήνυμα (η εφαρμογή δείχνει δικό της, π.χ. σε πεδίο του aside)
  //     resizable    true: το πλαίσιο μεγαλώνει από κάτω δεξιά, και κρατά το ύψος του σε προβολή και επεξεργασία
  //     className    επιπλέον κλάσεις του πλαισίου
  //     onChange(value, {removed})  μετά την «Αποδοχή» ή τη διαγραφή («×»)
  //     onEditing(editing)          όταν ανοίγει ή κλείνει η επεξεργασία (πριν σχεδιαστεί το πλαίσιο)
  //   Ένα κείμενο χωρίς ορατό κείμενο δίνει {html:'', tags:[]}, ακόμη κι αν είχε ετικέτες. Οι γενικές ετικέτες που
  //   διαγράφονται στη «Διαχείριση ετικετών…» φεύγουν και από αυτό το πλαίσιο· από τα άλλα στοιχεία τις βγάζει η
  //   εφαρμογή στο onRegistry. Η εμφάνιση είναι στο _ui.css (.school-tagged-text*), με τα χρώματα
  //   --school-tagged-text-bg (πλαίσιο) και --school-tagged-text-editor-bg (πεδίο), και με aside τις στήλες
  //   --school-tagged-text-columns.
  function createTaggedText(options = {}) {
    const Tags = tagsLib();
    const texts = {empty: '', edit: 'Επεξεργασία', create: 'Νέο κείμενο', remove: 'Διαγραφή', accept: 'Αποδοχή αλλαγών', cancel: 'Ακύρωση αλλαγών',
      removeConfirm: '', removeTitle: 'Διαγραφή', pickTitle: 'Ετικέτες', ...(options.texts || {})};
    const tagOptions = options.tags || {};
    const tagData = () => (typeof tagOptions.data === 'function' ? tagOptions.data() : tagOptions.data) || {};
    const hasText = html => window.SchoolHtml ? window.SchoolHtml.hasText(html) : !!String(html ?? '').replace(/<[^>]*>/g, '').trim();
    const normal = value => {
      const html = cleanHtml(value?.html ?? '');
      return hasText(html) ? {html, tags: Tags.clean(value?.tags)} : {html: '', tags: []};
    };
    const generalIds = tags => (tags?.general || []).map(item => item.id);
    const aside = options.aside instanceof Element ? options.aside : null;
    let value = normal(options.value), editing = false, rich = null, activeTags = [], height = null, error = null;
    const box = document.createElement('div');
    box.className = 'school-tagged-text' + (options.className ? ' ' + options.className : '') + (options.resizable ? ' is-resizable' : '') + (aside ? ' has-aside' : '');
    const locked = () => typeof options.locked === 'function' ? !!options.locked() : !!options.locked;
    const showTools = () => typeof options.tools === 'function' ? !!options.tools() : options.tools !== false;
    // The height the user gave to a resizable box, kept between view and editing.
    const sizedPart = () => box.querySelector(editing ? '.school-richtext-editor' : '.school-tagged-text-body');
    // The height is kept as the height of the text area, without paddings and borders, because the field of the
    // editor has more padding than the text in view.
    const frame = part => { const style = getComputedStyle(part); return ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((sum, key) => sum + (parseFloat(style[key]) || 0), 0); };
    const keepHeight = () => { const part = options.resizable && sizedPart(); if (part && part.style.height) height = part.getBoundingClientRect().height - frame(part); };
    const applyHeight = () => { const part = options.resizable && sizedPart(); if (part && height) part.style.height = (height + frame(part)) + 'px'; };
    const setEditing = next => { if (editing === next) return; editing = next; options.onEditing?.(editing); };
    // The validation message under the field (validate returned a text); it goes away when the user types.
    const showError = message => {
      if (!error) return;
      error.textContent = message || '';
      if (message) rich?.editor.setAttribute('aria-invalid', 'true'); else rich?.editor.removeAttribute('aria-invalid');
    };

    const chooseTags = async () => {
      if (!editing) return;
      const current = {html: rich ? rich.html : value.html, tags: activeTags};
      const data = tagData();
      const result = await tagPick({title: texts.pickTitle, refs: activeTags, data, usage: id => tagOptions.usage ? tagOptions.usage(id, current) : [], limits: tagOptions.limits});
      if (!result || !editing) return;
      const kept = new Set(generalIds(result.tags)), removed = generalIds(data.tags).filter(id => !kept.has(id));
      activeTags = result.refs;
      if (removed.length) value = {...value, tags: value.tags.filter(ref => !(ref.type === 'general' && removed.includes(ref.id)))};
      tagOptions.onRegistry?.(result.tags, removed);
      replaceTagBar();
    };
    const tagBar = () => {
      const bar = document.createElement('div'); bar.className = 'school-tagged-text-tagbar';
      const chips = tagChips(activeTags, tagData(), {onRemove: ref => { activeTags = activeTags.filter(tag => !Tags.same(tag, ref)); replaceTagBar(); }});
      if (chips.childElementCount) bar.append(chips);
      else { const none = document.createElement('span'); none.className = 'school-tagged-text-tagbar-empty'; none.textContent = 'Χωρίς ετικέτες'; bar.append(none); }
      const button = document.createElement('button'); button.type = 'button'; button.className = 'ui-compact-button'; button.textContent = 'Ετικέτες…';
      button.addEventListener('click', chooseTags);
      bar.append(button);
      return bar;
    };
    // Only the tag bar is drawn again, so the text written so far stays in the editor.
    const replaceTagBar = () => {
      const old = box.querySelector('.school-tagged-text-tagbar');
      if (!old) return;
      old.replaceWith(tagBar());
      box.querySelector('.school-tagged-text-tagbar > button')?.focus();
    };
    const iconButton = (label, icon, click) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'school-tagged-text-tool';
      button.innerHTML = schoolIcon(icon); button.title = label; button.setAttribute('aria-label', label);
      button.disabled = locked(); button.addEventListener('click', click);
      return button;
    };
    // «Αποδοχή» / «Ακύρωση»: in the toolbar of the editor, or, with an aside, above the aside.
    const actionSpecs = () => [
      {label: 'Αποδοχή', title: texts.accept, accept: true, run: () => commit()},
      {label: 'Ακύρωση', title: texts.cancel, run: () => cancel()}
    ];
    const sideActions = () => {
      const actions = document.createElement('div'); actions.className = 'school-tagged-text-actions';
      for (const spec of actionSpecs()) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'ui-compact-button' + (spec.accept ? ' primary' : '');
        button.textContent = spec.label; button.title = spec.title; button.setAttribute('aria-label', spec.title);
        button.addEventListener('click', spec.run);
        actions.append(button);
      }
      return actions;
    };
    const side = children => {
      const part = document.createElement('div'); part.className = 'school-tagged-text-side';
      part.append(...children);
      return part;
    };
    const render = () => {
      box.classList.toggle('is-editing', editing);
      box.classList.remove('has-before');
      box.replaceChildren();
      error = null;
      if (editing) {
        const content = document.createElement('div'); content.className = 'school-tagged-text-content school-tagged-text-editor';
        error = document.createElement('div'); error.className = 'ui-validation-error school-tagged-text-error'; error.setAttribute('role', 'alert');
        content.append(rich.element, error);
        if (aside) box.append(content, side([sideActions(), aside]), tagBar());
        else { content.append(tagBar()); box.append(content); }
        applyHeight();
        return;
      }
      const before = !!options.before && showTools();
      box.classList.toggle('has-before', before);
      if (before) box.append(options.before);
      const content = document.createElement('div'); content.className = 'school-tagged-text-content';
      const body = document.createElement('div'); body.className = 'school-tagged-text-body';
      if (value.html) { body.classList.add('school-tagged-text-html'); body.innerHTML = cleanHtml(value.html); }
      else { body.classList.add('school-tagged-text-empty'); body.textContent = texts.empty; }
      content.append(body);
      box.append(content);
      if (showTools()) {
        const tools = document.createElement('div'); tools.className = 'school-tagged-text-tools';
        tools.append(iconButton(value.html ? texts.edit : texts.create, 'edit', () => { if (!locked()) edit(true); }));
        if (value.html) tools.append(iconButton(texts.remove, 'close', async () => {
          if (locked() || editing) return;
          if (texts.removeConfirm && !await schoolConfirm(texts.removeConfirm, {title: texts.removeTitle, accept: 'Διαγραφή'})) return;
          value = {html: '', tags: []};
          render();
          options.onChange?.(value, {removed: true});
        }));
        if (!aside) box.append(tools);
        // With an aside, the buttons go to the top right of its column, over the first line of its content.
        else { box.append(side([tools, aside])); box.lastElementChild.classList.add('has-tools'); }
      }
      if (aside && !box.querySelector(':scope > .school-tagged-text-side')) box.append(side([aside]));
      const chips = tagChips(value.tags, tagData());
      if (chips.childElementCount) {
        const footer = document.createElement('div'); footer.className = 'school-tagged-text-tags';
        footer.append(chips); box.append(footer);
      }
      applyHeight();
    };
    const close = () => { keepHeight(); rich = null; activeTags = []; setEditing(false); render(); };
    function edit(focus = true) {
      if (editing) return;
      keepHeight();
      activeTags = structuredClone(value.tags);
      rich = createRichText({html: value.html, label: options.label, color: options.color, actions: aside ? [] : actionSpecs()});
      rich.editor.addEventListener('input', () => showError(''));
      setEditing(true);
      render();
      if (focus) rich.focus();
    }
    // «Αποδοχή»: keeps the text and the tags (a text without visible text is empty, also without tags), after
    // options.validate allows it.
    function commit() {
      if (!editing || !rich) return false;
      const next = normal({html: rich.html, tags: activeTags});
      const verdict = options.validate ? options.validate(structuredClone(next)) : true;
      if (typeof verdict === 'string' && verdict) { showError(verdict); rich.focus(); return false; }
      if (verdict === false) return false;
      value = next;
      close();
      options.onChange?.(value, {removed: false});
      return true;
    }
    function cancel() { if (editing) close(); }
    if (options.editing) edit(false); else render();
    return {
      element: box,
      get value() { return structuredClone(value); },
      get editing() { return editing; },
      edit, commit, cancel,
      refresh() { if (!editing) render(); else replaceTagBar(); },
      focus() { if (rich) rich.focus(); else box.querySelector('.school-tagged-text-tools button')?.focus(); }
    };
  }
  const schoolTaggedText = Object.freeze({create: createTaggedText});


  // Λίστα προβλημάτων μιας περιόδου (π.χ. τα προβλήματα της σύνθεσης, SchoolTimetable.compositionProblems): μία γραμμή
  // με την κατάσταση (κόκκινο «!» με συγκρούσεις, πορτοκαλί με προειδοποιήσεις, πράσινο τικ χωρίς προβλήματα) και το
  // πλήθος ως κουμπί-σύνδεσμο που ανοίγει τη λίστα, σε ομάδες. Κάθε γραμμή έχει το μήνυμα και, όταν η εφαρμογή τον
  // δίνει, σύνδεσμο στο τέλος.
  //   schoolProblems.render(box, {problems, failure, open, onToggle, link, help, label, compact, listBox}) → η σύνοψη
  //   {state:'error'|'warning'|'ok', conflicts, warnings, infos, text}
  //     problems  [{group:'staff'|'class'|'warning'|'info', message, …}]· οι ομάδες με αυτή τη σειρά
  //     failure   κείμενο: ο έλεγχος δεν έγινε (πορτοκαλί, χωρίς λίστα)
  //     open      αν η λίστα είναι ανοιχτή· onToggle(open): καλείται όταν ο χρήστης την ανοίγει ή την κλείνει (η
  //               εφαρμογή κρατά την τιμή· το component ξαναζωγραφίζεται μόνο του)
  //     link(problem) → {label, title, run} | null: ο σύνδεσμος της γραμμής· run(problem) στο κλικ
  //     help      κείμενο κάτω από τη λίστα· label: το κείμενο πριν από το πλήθος (προεπιλογή «Έλεγχος περιόδου:»)
  //     compact   χωρίς πλαίσιο, με γράμματα 13px (π.χ. κάτω από την Περίοδο στο Πλήρες Σχολικό Πρόγραμμα)
  //     listBox   στοιχείο όπου μπαίνει η ανοιχτή λίστα, σε δικό της πλαίσιο, αντί για κάτω από τη γραμμή· κρύβεται
  //               όταν η λίστα είναι κλειστή
  //   Η εμφάνιση ορίζεται στο _ui.css (.school-problems*).
  const PROBLEM_GROUPS = Object.freeze([['staff', 'Συγκρούσεις εκπαιδευτικών'], ['class', 'Συγκρούσεις τμημάτων'], ['warning', 'Προειδοποιήσεις'], ['info', 'Ενημερώσεις']]);
  const problemCount = (count, one, many) => count + ' ' + (count === 1 ? one : many);
  function problemsSummary(problems, failure) {
    const count = group => problems.filter(item => item.group === group).length;
    const conflicts = count('staff') + count('class'), warnings = count('warning'), infos = count('info');
    const infoText = infos ? problemCount(infos, 'ενημέρωση', 'ενημερώσεις') : '';
    if (failure) return {state: 'warning', icon: 'warning', conflicts, warnings, infos, text: failure};
    if (conflicts || warnings) {
      return {state: conflicts ? 'error' : 'warning', icon: conflicts ? 'alert' : 'warning', conflicts, warnings, infos,
        text: [conflicts ? problemCount(conflicts, 'σύγκρουση', 'συγκρούσεις') : '', warnings ? problemCount(warnings, 'προειδοποίηση', 'προειδοποιήσεις') : '', infoText].filter(Boolean).join(' · ')};
    }
    return {state: 'ok', icon: 'check', conflicts, warnings, infos, text: 'Χωρίς συγκρούσεις και προειδοποιήσεις' + (infoText ? ' · ' + infoText : '')};
  }
  function renderProblems(box, options = {}) {
    const problems = (Array.isArray(options.problems) ? options.problems : []).filter(item => item && typeof item === 'object');
    const failure = String(options.failure || ''), summary = problemsSummary(problems, failure);
    const result = {state: summary.state, conflicts: summary.conflicts, warnings: summary.warnings, infos: summary.infos, text: summary.text};
    if (!box) return result;
    const open = !!options.open, listBox = options.listBox || null;
    const hideList = () => { if (listBox) { listBox.hidden = true; listBox.replaceChildren(); } };
    box.classList.add('school-problems');
    box.classList.toggle('school-problems-compact', !!options.compact);
    const head = document.createElement('div'), label = document.createElement('span');
    head.className = 'school-problems-head';
    label.className = 'school-problems-state ' + summary.state;
    label.innerHTML = schoolIconText(summary.icon, problems.length && !failure ? options.label || 'Έλεγχος περιόδου:' : summary.text);
    head.append(label);
    if (!problems.length || failure) { box.replaceChildren(head); hideList(); return result; }
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'ui-link-button'; toggle.setAttribute('aria-expanded', String(open));
    toggle.innerHTML = schoolIconText(open ? 'chevron-down' : 'chevron-right', summary.text, {end: true});
    toggle.title = open ? 'Απόκρυψη της λίστας' : 'Πού είναι κάθε πρόβλημα και από ποιες πηγές προκαλείται';
    toggle.onclick = () => {
      const next = !open;
      if (typeof options.onToggle === 'function') options.onToggle(next);
      renderProblems(box, {...options, open: next});
      box.querySelector('.school-problems-head .ui-link-button')?.focus();
    };
    head.append(toggle);
    if (!open) { box.replaceChildren(head); hideList(); return result; }
    const list = document.createElement('div');
    list.className = 'school-problems-list';
    for (const [group, title] of PROBLEM_GROUPS) {
      const items = problems.filter(item => item.group === group);
      if (!items.length) continue;
      const heading = document.createElement('h3'), ul = document.createElement('ul');
      heading.textContent = title + ' (' + items.length + ')';
      for (const item of items) {
        const li = document.createElement('li'), textNode = document.createElement('span');
        textNode.textContent = String(item.message ?? '');
        li.append(textNode);
        const link = typeof options.link === 'function' ? options.link(item) : null;
        if (link?.label && typeof link.run === 'function') {
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'ui-link-button';
          button.innerHTML = schoolIconText('chevron-right', link.label, {end: true});
          if (link.title) button.title = link.title;
          button.onclick = () => link.run(item);
          li.append(button);
        }
        ul.append(li);
      }
      list.append(heading, ul);
    }
    if (options.help) {
      const help = document.createElement('p');
      help.className = 'ui-helper'; help.textContent = String(options.help);
      list.append(help);
    }
    if (listBox) {
      box.replaceChildren(head);
      listBox.classList.add('school-problems-panel');
      listBox.hidden = false;
      listBox.replaceChildren(list);
    } else box.replaceChildren(head, list);
    return result;
  }
  const schoolProblems = Object.freeze({render: renderProblems});

  // Αναδυόμενο μενού (π.χ. «⋮» μιας κάρτας, «⋯» της κεφαλίδας), ένα τη φορά.
  //   schoolMenu.open(anchor, items, {label, align}) → Promise με την τιμή (value) του στοιχείου που επιλέχθηκε, ή
  //   null όταν το μενού κλείσει χωρίς επιλογή (Esc, κλικ έξω, Tab, αλλαγή μεγέθους, ή δεύτερο κλικ στο ίδιο κουμπί).
  //     anchor  το κουμπί που ανοίγει το μενού· παίρνει aria-haspopup / aria-expanded, και η εστίαση γυρίζει σε αυτό
  //     items   [{label, value, disabled, title, danger} | {separator:true}]· διαχωριστικά στην αρχή, στο τέλος ή
  //             δύο μαζί δεν μπαίνουν
  //     label   aria-label του μενού· align: 'end' (προεπιλογή, η δεξιά άκρη του μενού στη δεξιά άκρη του κουμπιού)
  //             ή 'start'
  //   Πλήκτρα: βέλη, Home / End, Enter / διάστημα, Esc. Η εμφάνιση ορίζεται στο _ui.css (.ui-menu).
  let activeMenu = null;
  function openSchoolMenu(anchor, items, options = {}) {
    if (activeMenu) {
      const same = activeMenu.anchor === anchor;
      activeMenu.close(null, !same);
      if (same) { anchor?.focus(); return Promise.resolve(null); }
    }
    return new Promise(resolve => {
      const menu = document.createElement('div');
      menu.className = 'ui-menu'; menu.setAttribute('role', 'menu'); menu.tabIndex = -1;
      if (options.label) menu.setAttribute('aria-label', options.label);
      for (const item of items || []) {
        if (!item) continue;
        if (item.separator) {
          if (menu.lastElementChild && !menu.lastElementChild.classList.contains('ui-menu-separator')) {
            const line = document.createElement('div'); line.className = 'ui-menu-separator'; line.setAttribute('role', 'separator'); menu.append(line);
          }
          continue;
        }
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'ui-menu-item' + (item.danger ? ' danger' : '');
        button.setAttribute('role', 'menuitem'); button.textContent = item.label;
        if (item.title) button.title = item.title;
        if (item.disabled) { button.disabled = true; button.setAttribute('aria-disabled', 'true'); }
        button.onclick = () => close(item.value === undefined ? item.label : item.value, true);
        menu.append(button);
      }
      if (menu.lastElementChild?.classList.contains('ui-menu-separator')) menu.lastElementChild.remove();
      const enabled = () => [...menu.querySelectorAll('.ui-menu-item:not(:disabled)')];
      const onKey = event => {
        const list = enabled(), index = list.indexOf(document.activeElement);
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(null, true); }
        else if (event.key === 'Tab') close(null, false);
        else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (list.length) list[(index + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
        } else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); list[event.key === 'Home' ? 0 : list.length - 1]?.focus(); }
      };
      const onPointer = event => { if (!menu.contains(event.target) && !anchor?.contains(event.target)) close(null, false); };
      const onMove = event => { if (!menu.contains(event.target)) close(null, false); };
      function close(value, restoreFocus) {
        if (activeMenu?.menu !== menu) return;
        activeMenu = null;
        document.removeEventListener('pointerdown', onPointer, true);
        window.removeEventListener('resize', onMove);
        window.removeEventListener('scroll', onMove, true);
        menu.remove();
        anchor?.setAttribute('aria-expanded', 'false');
        if (restoreFocus && anchor?.isConnected) anchor.focus();
        resolve(value);
      }
      menu.addEventListener('keydown', onKey);
      document.body.append(menu);
      activeMenu = {menu, anchor, close};
      anchor?.setAttribute('aria-haspopup', 'menu');
      anchor?.setAttribute('aria-expanded', 'true');
      // Under the button, inside the window: above it when there is no room below.
      const rect = anchor ? anchor.getBoundingClientRect() : {left: 8, right: 8, top: 8, bottom: 8};
      const width = menu.offsetWidth, height = menu.offsetHeight, gap = 4, margin = 8;
      let left = options.align === 'start' ? rect.left : rect.right - width;
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      let top = rect.bottom + gap;
      if (top + height > window.innerHeight - margin && rect.top - gap - height >= margin) top = rect.top - gap - height;
      menu.style.left = left + 'px'; menu.style.top = Math.max(margin, top) + 'px';
      document.addEventListener('pointerdown', onPointer, true);
      window.addEventListener('resize', onMove);
      window.addEventListener('scroll', onMove, true);
      (enabled()[0] || menu).focus();
    });
  }
  const schoolMenu = Object.freeze({open: openSchoolMenu, close: () => activeMenu?.close(null, false)});

  window.schoolMessage = schoolMessage;
  window.schoolConfirm = schoolConfirm;
  window.schoolChoiceDialog = schoolChoiceDialog;
  window.schoolProgramImport = schoolProgramImport;
  window.schoolBackupConfirm = schoolBackupConfirm;
  window.schoolColorPicker = schoolColorPicker;
  window.schoolRichText = schoolRichText;
  // tones(color): the light tones of a colour as on the tag chips ({bg, border, ink}), for anything that is shown
  // like a tag (e.g. the subjects of the Ατομικά Προγράμματα).
  window.schoolColor = Object.freeze({normalize: normalColor, ink: inkFor, valid: validColor, tones: tagTones});
  window.schoolEscape = schoolEscape;
  window.schoolIcon = schoolIcon;
  window.schoolIconText = schoolIconText;
  window.schoolListSelection = schoolListSelection;
  window.schoolHost = schoolHost;
  window.schoolTags = schoolTags;
  window.schoolTaggedText = schoolTaggedText;
  window.schoolMenu = schoolMenu;
  window.schoolProblems = schoolProblems;
  window.schoolPeriodSelect = schoolPeriodSelect;
})();
