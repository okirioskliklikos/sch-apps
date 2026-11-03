/*
 * Εφαρμογές σχολείου — Σχολικό Ημερολόγιο στο Κεντρικό Μενού (host)
 * Έκδοση αρχείου: 0.2
 * Όνομα κατά την εγκατάσταση: _host_calendar.js
 *
 * Κώδικας μόνο του host για το Σχολικό Ημερολόγιο (calendarByYear). Το φορτώνει το index.html μετά το
 * _data.js και πριν από το δικό του script: <script src="_host_calendar.js"></script>. Δεν το φορτώνουν
 * οι υποεφαρμογές· μόνο το data_test.html, για να ελέγξει τις καθαρές συναρτήσεις του.
 * Δεν έχει περιβάλλον χρήστη. Ορίζει το window.SchoolHostCalendar:
 *   APP                                     το αρχείο της εφαρμογής (school_calendar.html)
 *   yearData(data, year)                    το calendarByYear[year] ({entries, ssdMeetings, pedagogicMeetings})
 *   context(data, revision)                 το school-calendar:context
 *   validateCalendar(calendar, year, staff) έλεγχος των δεδομένων ενός έτους· επιστρέφει καθαρό αντίγραφο
 *                                           (πετά λάθος)
 *   applySave(data, message)                εφαρμογή ενός school-calendar:save σε αντίγραφο του data
 *   zoom(data)                              το ζουμ του Ημερολογίου (calendarSettings.zoom, κοινό για όλα τα έτη)
 *   withZoom(data, zoom)                    αντίγραφο του data με νέο ζουμ
 *   removeStaff(data, year, ids)            αφαιρεί εκπαιδευτικούς (id) από τις συνεδριάσεις ενός έτους
 *                                           (αλλάζει το data· για το αντίγραφο της αποθήκευσης του Προσωπικού)
 *   install(bridge)                         σύνδεση με το index (πρωτόκολλο school-calendar:*)
 *
 * Στο .data:
 *   calendarByYear[year] = {entries:{'YYYY-MM-DD':{personal, school}}, ssdMeetings:{'YYYY-MM-DD':{…}},
 *                           pedagogicMeetings:{'YYYY-MM-DD':{…}}}
 *   calendarSettings = {zoom}   έξω από το calendarByYear, ώστε να ισχύει για όλα τα σχολικά έτη. Δεν μετρά
 *                               ως αλλαγή δεδομένων: γράφεται όπως το lastViewByYear (βλέπε install).
 * Οι εκπαιδευτικοί των συνεδριάσεων αναφέρονται με το id τους στο Προσωπικό (present, absent, absenceReasons,
 * scheduleAutoReasons, leaveAutoIds, directorId), όπως στα προγράμματα: αλλαγή κωδικού ή ονόματος δεν τους επηρεάζει.
 */
(() => {
  'use strict';
  const D = window.SchoolDate;
  if (!D) throw Error('Το _host_calendar.js χρειάζεται το _data.js, φορτωμένο πριν από αυτό. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.');

  const APP = 'school_calendar.html';
  // Όρια: πιάνουν λάθη εφαρμογών, όχι πραγματικά δεδομένα (ένα σχολικό έτος έχει έως 366 ημέρες).
  const LIMITS = Object.freeze({html: 200000, subject: 20000, name: 300, id: 200, people: 300});
  const ZOOM = Object.freeze({min: 70, max: 150, step: 10, fallback: 100});
  const REASONS = Object.freeze(['leave', 'leavePending', 'lesson', 'otherSchool', 'other']);
  const AUTO_REASONS = Object.freeze(['lesson', 'otherSchool']);
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

  const clone = value => structuredClone(value);
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const isText = (value, max) => typeof value === 'string' && value.length <= max;
  const formatDate = iso => D.format(iso);

  // ---- Δεδομένα του έτους ----
  // Το calendarByYear[year], ή κενή δομή όταν δεν υπάρχει ακόμη. Δεν αλλάζει το data.
  function yearData(data, year) {
    const value = isObject(data?.calendarByYear) ? data.calendarByYear[year] : null;
    return {
      entries: isObject(value?.entries) ? value.entries : {},
      ssdMeetings: isObject(value?.ssdMeetings) ? value.ssdMeetings : {},
      pedagogicMeetings: isObject(value?.pedagogicMeetings) ? value.pedagogicMeetings : {}
    };
  }
  function zoom(data) {
    const value = Number(data?.calendarSettings?.zoom);
    return Number.isInteger(value) && value >= ZOOM.min && value <= ZOOM.max ? value : ZOOM.fallback;
  }
  function withZoom(data, value) {
    const settings = isObject(data?.calendarSettings) ? data.calendarSettings : {};
    return {...data, calendarSettings: {...settings, zoom: value}};
  }

  // school-calendar:context: το Προσωπικό και το Ημερολόγιο του έτους, και το ζουμ.
  function context(data, revision) {
    const year = data.school.year;
    return clone({
      revision, school: {...data.school}, year,
      staff: Array.isArray(data?.staffByYear?.[year]) ? data.staffByYear[year] : [],
      calendar: yearData(data, year),
      zoom: zoom(data),
      zoomLimits: {min: ZOOM.min, max: ZOOM.max, step: ZOOM.step}
    });
  }

  // ---- Έλεγχοι ----
  function checkDate(key, year, what) {
    if (!D.valid(key)) throw Error('Μη έγκυρη ημερομηνία ' + what + ' («' + String(key).slice(0, 20) + '»).');
    if (!D.inSchoolYear(key, year)) throw Error('Η ημερομηνία ' + formatDate(key) + ' (' + what + ') είναι έξω από το σχολικό έτος ' + year + '.');
  }
  // A reference to a person: the id of a person of Προσωπικό for the year (as in the programs).
  function checkPerson(id, ids, when) {
    if (!isText(id, LIMITS.id) || !id) throw Error('Μη έγκυρος εκπαιδευτικός στη συνεδρίαση της ' + when + '.');
    if (!ids.has(id)) throw Error('Η συνεδρίαση της ' + when + ' αναφέρεται σε εκπαιδευτικό που δεν υπάρχει στο Προσωπικό του έτους. Βεβαιώσου ότι το school_calendar.html είναι η τελευταία έκδοση.');
  }
  function idList(value, label, when, ids) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > LIMITS.people) throw Error('Μη έγκυρη λίστα «' + label + '» στη συνεδρίαση της ' + when + '.');
    const list = [];
    for (const id of value) { checkPerson(id, ids, when); if (!list.includes(id)) list.push(id); }
    return list;
  }
  function reasonMap(value, allowed, label, when, ids) {
    if (value == null) return {};
    if (!isObject(value)) throw Error('Μη έγκυρες ' + label + ' στη συνεδρίαση της ' + when + '.');
    const out = {};
    for (const [id, reason] of Object.entries(value)) {
      checkPerson(id, ids, when);
      if (!allowed.includes(reason)) throw Error('Μη έγκυρη αιτιολογία απουσίας στη συνεδρίαση της ' + when + '.');
      out[id] = reason;
    }
    return out;
  }
  function validateMeeting(meeting, key, ssd, ids) {
    const when = formatDate(key);
    if (!isObject(meeting)) throw Error('Μη έγκυρη συνεδρίαση στις ' + when + '.');
    if (!TIME.test(meeting.startTime || '') || !TIME.test(meeting.endTime || '')) throw Error('Μη έγκυρη ώρα στη συνεδρίαση της ' + when + ' (μορφή HH:MM).');
    if (!(meeting.startTime < meeting.endTime)) throw Error('Η ώρα λήξης της συνεδρίασης της ' + when + ' δεν είναι μετά την ώρα έναρξης.');
    for (const field of ['subject', 'directorName']) {
      if (meeting[field] != null && !isText(meeting[field], field === 'subject' ? LIMITS.subject : LIMITS.name)) throw Error('Μη έγκυρο κείμενο στη συνεδρίαση της ' + when + '.');
    }
    if (meeting.directorId) checkPerson(meeting.directorId, ids, when);
    const present = idList(meeting.present, 'Παρόντες', when, ids), absent = idList(meeting.absent, 'Απόντες', when, ids);
    if (present.some(id => absent.includes(id))) throw Error('Ένας εκπαιδευτικός είναι και στους Παρόντες και στους Απόντες στη συνεδρίαση της ' + when + '.');
    const out = {
      startTime: meeting.startTime, endTime: meeting.endTime,
      subject: meeting.subject || '', directorId: meeting.directorId || '', directorName: meeting.directorName || '',
      present, absent,
      absenceReasons: reasonMap(meeting.absenceReasons, REASONS, 'αιτιολογίες', when, ids),
      scheduleAutoReasons: reasonMap(meeting.scheduleAutoReasons, AUTO_REASONS, 'αυτόματες αιτιολογίες', when, ids),
      leaveAutoIds: idList(meeting.leaveAutoIds, 'άδειες', when, ids)
    };
    if (ssd) {
      if (!Number.isSafeInteger(meeting.actNumber) || meeting.actNumber < 1) throw Error('Ο αριθμός πράξης της συνεδρίασης της ' + when + ' πρέπει να είναι θετικός ακέραιος.');
      out.actNumber = meeting.actNumber;
    }
    return out;
  }
  // Τα δεδομένα του Ημερολογίου για ένα έτος. Απορρίπτει ό,τι θα χαλούσε τα δεδομένα· επιστρέφει καθαρό
  // αντίγραφο (οι κενές σημειώσεις δεν κρατιούνται). staff: το Προσωπικό του έτους, για τα id των συνεδριάσεων.
  function validateCalendar(calendar, year, staff) {
    const ids = new Set((Array.isArray(staff) ? staff : []).map(person => person?.id).filter(Boolean));
    if (!isObject(calendar)) throw Error('Μη έγκυρα δεδομένα Ημερολογίου. Βεβαιώσου ότι το school_calendar.html είναι η τελευταία έκδοση.');
    const out = {entries: {}, ssdMeetings: {}, pedagogicMeetings: {}};
    const entries = calendar.entries ?? {};
    if (!isObject(entries)) throw Error('Μη έγκυρες σημειώσεις Ημερολογίου.');
    for (const [key, entry] of Object.entries(entries)) {
      checkDate(key, year, 'σημειώσεων');
      if (!isObject(entry) || !isText(entry.personal ?? '', LIMITS.html) || !isText(entry.school ?? '', LIMITS.html))
        throw Error('Μη έγκυρες σημειώσεις στις ' + formatDate(key) + '.');
      const personal = entry.personal || '', school = entry.school || '';
      if (personal || school) out.entries[key] = {personal, school};
    }
    for (const [field, ssd] of [['ssdMeetings', true], ['pedagogicMeetings', false]]) {
      const meetings = calendar[field] ?? {};
      if (!isObject(meetings)) throw Error('Μη έγκυρες συνεδριάσεις Ημερολογίου.');
      for (const [key, meeting] of Object.entries(meetings)) {
        checkDate(key, year, ssd ? 'συνεδρίασης ΣΣΔ' : 'παιδαγωγικής συνάντησης');
        out[field][key] = validateMeeting(meeting, key, ssd, ids);
      }
    }
    const acts = new Map();
    for (const [key, meeting] of Object.entries(out.ssdMeetings).sort(([a], [b]) => a.localeCompare(b))) {
      if (acts.has(meeting.actNumber)) throw Error('Ο αριθμός πράξης ' + meeting.actNumber + ' υπάρχει στις ' + formatDate(acts.get(meeting.actNumber)) + ' και στις ' + formatDate(key) + '.');
      acts.set(meeting.actNumber, key);
    }
    return out;
  }
  // Το school-calendar:save σε αντίγραφο του data: αντικαθιστά μόνο το calendarByYear[year].
  // Τα υπόλοιπα έτη και τα άγνωστα πεδία του έτους μένουν όπως είναι.
  function applySave(data, message) {
    const year = data.school.year, staff = Array.isArray(data?.staffByYear?.[year]) ? data.staffByYear[year] : [];
    const calendar = validateCalendar(message.calendar, year, staff), candidate = clone(data);
    if (!isObject(candidate.calendarByYear)) candidate.calendarByYear = {};
    const previous = isObject(candidate.calendarByYear[year]) ? candidate.calendarByYear[year] : {};
    candidate.calendarByYear[year] = {...previous, ...calendar};
    return candidate;
  }
  // Οι εκπαιδευτικοί που διαγράφηκαν από το Προσωπικό (id) φεύγουν από τις συνεδριάσεις του έτους. Ο διευθυντής
  // μιας συνεδρίασης που διαγράφηκε μένει μόνο με το όνομά του (directorName).
  function removeStaff(data, year, ids) {
    const removed = new Set(ids || []);
    const value = isObject(data?.calendarByYear) ? data.calendarByYear[year] : null;
    if (!removed.size || !isObject(value)) return data;
    for (const meetings of [value.ssdMeetings, value.pedagogicMeetings]) {
      for (const meeting of Object.values(isObject(meetings) ? meetings : {})) {
        if (!isObject(meeting)) continue;
        for (const key of ['present', 'absent', 'leaveAutoIds']) if (Array.isArray(meeting[key])) meeting[key] = meeting[key].filter(id => !removed.has(id));
        for (const key of ['absenceReasons', 'scheduleAutoReasons']) if (isObject(meeting[key])) for (const id of removed) delete meeting[key][id];
        if (removed.has(meeting.directorId)) meeting.directorId = '';
      }
    }
    return data;
  }

  // ---- Σύνδεση με το index ----
  // bridge: {
  //   frame                  το iframe των υποεφαρμογών,
  //   acceptOrigin(event)    true όταν το origin του μηνύματος γίνεται δεκτό,
  //   targetOrigin           το origin των απαντήσεων ('*' σε file://),
  //   state()                → {data, revision, app, locked, busy} του index τη στιγμή της κλήσης,
  //   save(candidate)        Promise: γράφει το νέο data στο κοινό αρχείο και το κάνει τρέχον,
  //   activity()             μηδενίζει το ρολόι αδράνειας,
  //   menu()                 ανοίγει την αριστερή μπάρα (school-app:open-menu),
  //   dirty(value)           μη αποθηκευμένες αλλαγές της εφαρμογής,
  //   zoom(value)            νέο ζουμ· το index το κρατά χωρίς να μετρά ως αλλαγή και το γράφει όπως τις
  //                          τελευταίες επιλογές (lastViewByYear)
  // }
  function install(bridge) {
    window.addEventListener('message', async event => {
      const message = event.data;
      if (event.source !== bridge.frame.contentWindow || !bridge.acceptOrigin(event)) return;
      if (!isObject(message) || typeof message.type !== 'string') return;
      const state = bridge.state();
      if (state.locked || state.app !== APP) return;
      const source = event.source;
      const reply = payload => { const now = bridge.state(); if (now.app === APP && source === bridge.frame.contentWindow) source.postMessage(payload, bridge.targetOrigin); };
      if (message.type === 'school-app:open-menu') { bridge.activity?.(); bridge.menu?.(); return; }
      if (!message.type.startsWith('school-calendar:')) return;
      if (message.type === 'school-calendar:dirty') { bridge.dirty?.(!!message.dirty); return; }
      if (message.type === 'school-calendar:ready') {
        if (state.data) reply({type: 'school-calendar:context', context: context(state.data, state.revision)});
        return;
      }
      if (message.type === 'school-calendar:zoom') {
        const value = Number(message.zoom);
        if (!state.data || !Number.isInteger(value) || value < ZOOM.min || value > ZOOM.max) return;
        if (zoom(state.data) !== value) bridge.zoom?.(value);
        return;
      }
      if (message.type !== 'school-calendar:save' || typeof message.requestId !== 'string') return;
      bridge.activity?.();
      try {
        if (!state.data) throw Error('Άνοιξε πρώτα το κοινό αρχείο πληροφοριών του σχολείου.');
        if (state.busy) throw Error('Μια αποθήκευση βρίσκεται ήδη σε εξέλιξη.');
        if (message.revision !== state.revision || message.year !== state.data.school.year) throw Error('Το κοινό αρχείο άλλαξε. Φόρτωσε ξανά τα στοιχεία της εφαρμογής.');
        const candidate = applySave(state.data, message);
        await bridge.save(candidate);
        const now = bridge.state();
        reply({type: 'school-calendar:result', requestId: message.requestId, ok: true, context: context(now.data, now.revision)});
      } catch (error) {
        reply({type: 'school-calendar:result', requestId: message.requestId, ok: false, error: error?.name === 'AbortError' ? 'Η αποθήκευση ακυρώθηκε. Οι αλλαγές παραμένουν στη σελίδα.' : (error?.message || String(error))});
      }
    });
  }

  window.SchoolHostCalendar = Object.freeze({
    APP, LIMITS, ZOOM, REASONS, yearData, context, validateCalendar, applySave, zoom, withZoom, removeStaff, install
  });
})();
