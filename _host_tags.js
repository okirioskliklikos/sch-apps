/*
 * Εφαρμογές σχολείου — Ετικέτες στο Κεντρικό Μενού (host)
 * Έκδοση αρχείου: 0.03
 * Όνομα κατά την εγκατάσταση: _host_tags.js
 *
 * Κώδικας μόνο του host για τις ετικέτες (tagsByYear). Το φορτώνει το index.html μετά το _data.js και το
 * _host_students.js και πριν από το δικό του script: <script src="_host_tags.js"></script>. Δεν το φορτώνουν οι
 * υποεφαρμογές· μόνο το data_test.html, για να ελέγξει τις καθαρές συναρτήσεις του.
 * Δεν έχει περιβάλλον χρήστη ούτε δικό του πρωτόκολλο: το χρησιμοποιούν το _host_calendar.js, το _host_classes.js
 * και οι αποθηκεύσεις του Προσωπικού και των Μαθητών στο index. Ορίζει το window.SchoolHostTags:
 *   LIMITS                                  όρια ({general, perItem, name, warnRatio})
 *   HOLDERS                                 πού κρατά ετικέτες κάθε εφαρμογή ({app, one, many, items(data, year)})
 *   yearTags(data, year)                    το μητρώο του έτους ({general, colors, …}), ή κενό μητρώο
 *   validateRegistry(tags, app)             έλεγχος του μητρώου ενός έτους· επιστρέφει καθαρό αντίγραφο (πετά λάθος)
 *   known(data, year)                       τα id που μπορεί να έχει μια ετικέτα: {general, class, staff, student} (Set)
 *   validateRefs(refs, known, where, app)   έλεγχος των ετικετών ενός στοιχείου· επιστρέφει καθαρό αντίγραφο χωρίς
 *                                           διπλές (πετά λάθος). known:null → χωρίς έλεγχο ύπαρξης
 *   usage(data, year)                       χρήση των ετικετών στα αποθηκευμένα δεδομένα του έτους:
 *                                           {general, class, staff, student}, το καθένα {[id]: [{app, one, many, count}]}
 *   applyRegistry(candidate, year, tags, app)  νέο μητρώο του έτους στο candidate (αντίγραφο του data)· οι γενικές
 *                                           ετικέτες που αφαιρέθηκαν φεύγουν από τα δεδομένα όλων των εφαρμογών.
 *                                           → τα id που αφαιρέθηκαν
 *   removeRefs(data, year, type, ids)       αφαιρεί τις αναφορές σε ετικέτες ενός είδους (π.χ. εκπαιδευτικοί ή μαθητές
 *                                           που διαγράφηκαν) από τα δεδομένα του έτους (αλλάζει το data). → πόσες
 *
 * Στο .data:
 *   tagsByYear[year] = {general:[{id, name, color}], colors:{classes, staff, students}}
 *   Τα χρώματα είναι #rrggbb· όταν λείπει ένα χρώμα κατηγορίας ισχύει η προεπιλογή (SchoolTags.DEFAULT_COLORS).
 *   Το όνομα μιας γενικής ετικέτας είναι υποχρεωτικό, έως 60 χαρακτήρες και μοναδικό στο έτος (SchoolTags.nameKey).
 *   Τα άγνωστα πεδία του έτους και κάθε ετικέτας διατηρούνται.
 * Αναφορά σε ετικέτα: {type:'general'|'class'|'staff'|'student', id}, έως 40 ανά στοιχείο, χωρίς διπλές.
 * Μια νέα εφαρμογή που κρατά ετικέτες δηλώνεται στο HOLDERS: έτσι ισχύουν η μέτρηση χρήσης, το καθάρισμα των
 * αναφορών και οι έλεγχοι των «Τμημάτων» (ένα τμήμα που χρησιμοποιείται ως ετικέτα δεν αφαιρείται).
 */
(() => {
  'use strict';
  const Tags = window.SchoolTags;
  if (!Tags) throw Error('Το _host_tags.js χρειάζεται το _data.js, φορτωμένο πριν από αυτό. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.');

  // Όρια: πιάνουν λάθη εφαρμογών. Πάνω από το όριο η αποθήκευση απορρίπτεται· από το 90% (warnRatio) η εφαρμογή
  // δείχνει προειδοποίηση.
  const LIMITS = Object.freeze({general: 100, perItem: 40, name: 60, warnRatio: 0.9});
  const MAX_ID = 200;
  const COLOR_KEYS = Object.freeze(Object.values(Tags.COLOR_KEYS));

  const clone = value => structuredClone(value);
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const quoted = value => '«' + value + '»';
  const newer = app => ' Βεβαιώσου ότι το ' + (app || 'index.html') + ' είναι η τελευταία έκδοση.';

  // ---- Πού κρατούν ετικέτες οι εφαρμογές ----
  // Το κείμενο των συνεδριάσεων του Σχολικού Ημερολογίου (subject:{html, tags}), ανά είδος συνεδρίασης.
  function meetingHolder(field, one, many) {
    return Object.freeze({
      app: 'school_calendar.html', one, many,
      items(data, year) {
        const value = isObject(data?.calendarByYear) ? data.calendarByYear[year] : null, out = [];
        for (const meeting of Object.values(isObject(value?.[field]) ? value[field] : {})) {
          if (isObject(meeting?.subject) && meeting.subject.html) out.push(meeting.subject);
        }
        return out;
      }
    });
  }
  // items(data, year): τα στοιχεία του έτους που μπορεί να έχουν ετικέτες (τα ίδια τα αντικείμενα του data, ώστε το
  // καθάρισμα να τα αλλάζει), το καθένα με πεδίο tags.
  const HOLDERS = Object.freeze([
    Object.freeze({
      app: 'school_calendar.html', one: 'Προσωπική Σημείωση', many: 'Προσωπικές Σημειώσεις',
      items(data, year) {
        const value = isObject(data?.calendarByYear) ? data.calendarByYear[year] : null, out = [];
        for (const entry of Object.values(isObject(value?.entries) ? value.entries : {})) {
          for (const note of Array.isArray(entry?.personalNotes) ? entry.personalNotes : []) if (isObject(note)) out.push(note);
        }
        return out;
      }
    }),
    Object.freeze({
      app: 'school_calendar.html', one: 'Καταχώρηση Βιβλίου Σχολικής Ζωής', many: 'Καταχωρήσεις Βιβλίου Σχολικής Ζωής',
      items(data, year) {
        const value = isObject(data?.calendarByYear) ? data.calendarByYear[year] : null, out = [];
        for (const entry of Object.values(isObject(value?.entries) ? value.entries : {})) {
          if (isObject(entry?.schoolLifeBook) && entry.schoolLifeBook.html) out.push(entry.schoolLifeBook);
        }
        return out;
      }
    }),
    meetingHolder('ssdMeetings', 'Συνεδρίαση ΣΣΔ', 'Συνεδριάσεις ΣΣΔ'),
    meetingHolder('pedagogicMeetings', 'Παιδαγωγική Συνάντηση', 'Παιδαγωγικές Συναντήσεις')
  ]);

  // ---- Μητρώο ----
  function yearTags(data, year) {
    const value = isObject(data?.tagsByYear) ? data.tagsByYear[year] : null;
    if (!isObject(value)) return {general: [], colors: {}};
    return {...value, general: Array.isArray(value.general) ? value.general.filter(isObject) : [], colors: isObject(value.colors) ? value.colors : {}};
  }
  // Το μητρώο ενός έτους. Απορρίπτει ό,τι θα χαλούσε τα δεδομένα· επιστρέφει καθαρό αντίγραφο (ονόματα χωρίς κενά
  // στις άκρες, χρώματα με μικρά γράμματα, χωρίς κενά χρώματα κατηγορίας) με τα άγνωστα πεδία.
  function validateRegistry(tags, app) {
    if (!isObject(tags)) throw Error('Μη έγκυρο μητρώο ετικετών.' + newer(app));
    const general = tags.general ?? [];
    if (!Array.isArray(general)) throw Error('Μη έγκυρη λίστα γενικών ετικετών.' + newer(app));
    if (general.length > LIMITS.general) throw Error('Οι γενικές ετικέτες θα ήταν ' + general.length + ', πάνω από το όριο των ' + LIMITS.general + ' ανά σχολικό έτος. Η αποθήκευση δεν έγινε· διάγραψε από τη «Διαχείριση ετικετών» όσες δεν χρειάζονται.');
    const ids = new Set(), names = new Map(), out = [];
    for (const item of general) {
      if (!isObject(item) || typeof item.id !== 'string' || !item.id || item.id.length > MAX_ID) throw Error('Μη έγκυρη ταυτότητα γενικής ετικέτας.' + newer(app));
      if (ids.has(item.id)) throw Error('Βρέθηκαν διπλές ταυτότητες γενικών ετικετών.' + newer(app));
      ids.add(item.id);
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!name) throw Error('Το όνομα μιας γενικής ετικέτας είναι υποχρεωτικό.');
      if (name.length > LIMITS.name) throw Error('Το όνομα της ετικέτας ' + quoted(name.slice(0, LIMITS.name) + '…') + ' είναι πολύ μεγάλο (έως ' + LIMITS.name + ' χαρακτήρες).');
      const key = Tags.nameKey(name);
      if (names.has(key)) throw Error('Η ετικέτα ' + quoted(name) + ' υπάρχει δύο φορές (' + quoted(names.get(key)) + ').');
      names.set(key, name);
      if (!Tags.validColor(item.color)) throw Error('Μη έγκυρο χρώμα της ετικέτας ' + quoted(name) + '.' + newer(app));
      out.push({...clone(item), name, color: item.color.trim().toLowerCase()});
    }
    const colors = tags.colors ?? {};
    if (!isObject(colors)) throw Error('Μη έγκυρα χρώματα κατηγοριών ετικετών.' + newer(app));
    const cleanColors = clone(colors);
    for (const key of COLOR_KEYS) {
      if (cleanColors[key] == null || cleanColors[key] === '') { delete cleanColors[key]; continue; }
      if (!Tags.validColor(cleanColors[key])) throw Error('Μη έγκυρο χρώμα κατηγορίας ετικετών.' + newer(app));
      cleanColors[key] = cleanColors[key].trim().toLowerCase();
    }
    return {...clone(tags), general: out, colors: cleanColors};
  }

  // ---- Αναφορές ----
  function known(data, year) {
    const ids = list => new Set((Array.isArray(list) ? list : []).filter(item => isObject(item) && typeof item.id === 'string' && item.id).map(item => item.id));
    return {
      general: ids(yearTags(data, year).general),
      class: ids(isObject(data?.classesByYear) ? data.classesByYear[year]?.classes : null),
      staff: ids(isObject(data?.staffByYear) ? data.staffByYear[year] : null),
      student: ids(isObject(data?.studentsByYear) ? data.studentsByYear[year]?.students : null)
    };
  }
  const WHAT = {general: 'γενική ετικέτα που δεν υπάρχει στο μητρώο ετικετών', class: 'τμήμα που δεν υπάρχει στα «Τμήματα»', staff: 'εκπαιδευτικό που δεν υπάρχει στο Προσωπικό', student: 'μαθητή που δεν υπάρχει στους «Μαθητές»'};
  // Οι ετικέτες ενός στοιχείου. where: π.χ. «στην προσωπική σημείωση της 10/11/2026» (για τα μηνύματα).
  function validateRefs(refs, knownIds, where, app) {
    if (refs == null) return [];
    if (!Array.isArray(refs)) throw Error('Μη έγκυρες ετικέτες ' + where + '.' + newer(app));
    const out = [], seen = new Set();
    for (const ref of refs) {
      if (!isObject(ref) || !Tags.TYPES.includes(ref.type)) throw Error('Ετικέτα άγνωστου είδους ' + where + '.' + newer(app));
      if (typeof ref.id !== 'string' || !ref.id || ref.id.length > MAX_ID) throw Error('Μη έγκυρη ετικέτα ' + where + '.' + newer(app));
      if (knownIds && !knownIds[ref.type]?.has(ref.id)) throw Error('Μια ετικέτα ' + where + ' αναφέρεται σε ' + WHAT[ref.type] + ' του σχολικού έτους.' + newer(app));
      const key = ref.type + '\u0001' + ref.id;
      if (seen.has(key)) continue;
      seen.add(key); out.push({type: ref.type, id: ref.id});
    }
    if (out.length > LIMITS.perItem) throw Error('Υπάρχουν ' + out.length + ' ετικέτες ' + where + ', πάνω από το όριο των ' + LIMITS.perItem + ' ανά στοιχείο.');
    return out;
  }

  // ---- Χρήση ----
  function usage(data, year) {
    const out = {general: {}, class: {}, staff: {}, student: {}};
    for (const holder of HOLDERS) {
      const counts = {general: new Map(), class: new Map(), staff: new Map(), student: new Map()};
      for (const item of holder.items(data, year)) {
        for (const ref of Tags.clean(item.tags)) counts[ref.type].set(ref.id, (counts[ref.type].get(ref.id) || 0) + 1);
      }
      for (const [type, map] of Object.entries(counts)) {
        for (const [id, count] of map) (out[type][id] ||= []).push({app: holder.app, one: holder.one, many: holder.many, count});
      }
    }
    return out;
  }

  // ---- Καθάρισμα ----
  function removeRefs(data, year, type, ids) {
    const removed = new Set(ids || []);
    if (!removed.size) return 0;
    let count = 0;
    for (const holder of HOLDERS) {
      for (const item of holder.items(data, year)) {
        if (!Array.isArray(item.tags)) continue;
        const kept = item.tags.filter(ref => !(isObject(ref) && ref.type === type && removed.has(ref.id)));
        if (kept.length !== item.tags.length) { count += item.tags.length - kept.length; item.tags = kept; }
      }
    }
    return count;
  }
  function applyRegistry(candidate, year, tags, app) {
    const registry = validateRegistry(tags, app);
    const before = yearTags(candidate, year).general.map(item => item.id).filter(id => typeof id === 'string');
    const now = new Set(registry.general.map(item => item.id));
    const removed = before.filter(id => !now.has(id));
    if (!isObject(candidate.tagsByYear)) candidate.tagsByYear = {};
    candidate.tagsByYear[year] = registry;
    removeRefs(candidate, year, 'general', removed);
    return removed;
  }

  window.SchoolHostTags = Object.freeze({
    LIMITS, HOLDERS, yearTags, validateRegistry, known, validateRefs, usage, applyRegistry, removeRefs
  });
})();
