/*
 * Εφαρμογές σχολείου — Σχολικό Ημερολόγιο στο Κεντρικό Μενού (host)
 * Έκδοση αρχείου: 0.8
 * Όνομα κατά την εγκατάσταση: _host_calendar.js
 *
 * Κώδικας μόνο του host για το Σχολικό Ημερολόγιο (calendarByYear). Το φορτώνει το index.html μετά το
 * _data.js και πριν από το δικό του script: <script src="_host_calendar.js"></script>. Δεν το φορτώνουν
 * οι υποεφαρμογές· μόνο το data_test.html, για να ελέγξει τις καθαρές συναρτήσεις του.
 * Δεν έχει περιβάλλον χρήστη. Ορίζει το window.SchoolHostCalendar:
 *   APP                                     το αρχείο της εφαρμογής (school_calendar.html)
 *   yearData(data, year)                    το calendarByYear[year] ({entries, ssdMeetings, pedagogicMeetings})
 *   context(data, revision)                 το school-calendar:context
 *   validateCalendar(calendar, year, staff, known, people)  έλεγχος των δεδομένων ενός έτους· επιστρέφει καθαρό
 *                                           αντίγραφο (πετά λάθος). known: τα id των ετικετών (SchoolHostTags.known)·
 *                                           χωρίς αυτό ελέγχεται μόνο η μορφή των ετικετών. people: {students, classes}
 *                                           του έτους, για τους συμμετέχοντες των συμβάντων· χωρίς αυτό ελέγχεται
 *                                           μόνο η μορφή τους (το applySave το δίνει πάντα)
 *   applySave(data, message)                εφαρμογή ενός school-calendar:save σε αντίγραφο του data
 *   zoom(data)                              το ζουμ του Ημερολογίου (calendarSettings.zoom, κοινό για όλα τα έτη)
 *   withZoom(data, zoom)                    αντίγραφο του data με νέο ζουμ
 *   removeStaff(data, year, ids)            αφαιρεί εκπαιδευτικούς (id) από τις συνεδριάσεις ενός έτους
 *                                           (αλλάζει το data· για το αντίγραφο της αποθήκευσης του Προσωπικού)
 *   scoreUsage(data, year)                  σε πόσα Συμβάντα Ποινών / Επιβραβεύσεων του έτους βαθμολογείται κάθε μαθητής
 *                                           και τμήμα: {student, class}, το καθένα {[id]: [{app, one, many, count}]}
 *                                           (η μορφή του tagUsage)
 *   removeScores(data, year, type, ids)     αφαιρεί τις βαθμολογικές εγγραφές μαθητών ('student') ή τμημάτων ('class')
 *                                           από τα συμβάντα του έτους (αλλάζει το data· τα συμβάντα μένουν). → πόσες
 *   install(bridge)                         σύνδεση με το index (πρωτόκολλο school-calendar:*)
 *
 * Στο .data:
 *   calendarByYear[year] = {entries:{'YYYY-MM-DD':{personalNotes:[{id,html,tags}], schoolLifeBook:{html,tags},
 *                             behaviorEvents:[{id,html,tags,scores:[{type,id,points}]}]}}, ssdMeetings:{'YYYY-MM-DD':{…}},
 *                           pedagogicMeetings:{'YYYY-MM-DD':{…}}}
 * Ποινές / Επιβραβεύσεις (behaviorEvents): ταξινομημένος πίνακας συμβάντων ανά ημέρα· η σειρά του πίνακα είναι η σειρά
 * εμφάνισης. Κάθε συμβάν έχει id μοναδικό σε όλο το σχολικό έτος, υποχρεωτική περιγραφή (html με ορατό κείμενο,
 * καθαρισμένο με το SchoolHtml.sanitize), ετικέτες (όπως οι σημειώσεις) και scores: τους βαθμολογούμενους μαθητές
 * (type:'student', id των Μαθητών) και τμήματα (type:'class', id των Τμημάτων) του έτους, με τη σειρά τους, χωρίς
 * διπλό ζεύγος type + id. points: null (δεν αποφασίστηκε ακόμη) ή ακέραιος από LIMITS.pointsMin έως LIMITS.pointsMax
 * (0 = μηδενική βαθμολογία). Το null και το 0 είναι διαφορετικά και δεν μετατρέπονται ποτέ το ένα στο άλλο. Οι βαθμοί
 * των τμημάτων και των μαθητών είναι ανεξάρτητοι, και οι ετικέτες ανεξάρτητες από τα scores. Μια ημέρα χωρίς
 * behaviorEvents διαβάζεται με κενή λίστα· το host γράφει πάντα behaviorEvents (ή κενή λίστα).
 *   calendarSettings = {zoom}   έξω από το calendarByYear, ώστε να ισχύει για όλα τα σχολικά έτη. Δεν μετρά
 *                               ως αλλαγή δεδομένων: γράφεται όπως το lastViewByYear (βλέπε install).
 * Οι εκπαιδευτικοί των συνεδριάσεων αναφέρονται με το id τους στο Προσωπικό (present, absent, absenceReasons,
 * scheduleAutoReasons, leaveAutoIds, directorId), όπως στα προγράμματα: αλλαγή κωδικού ή ονόματος δεν τους επηρεάζει.
 * Το κείμενο μιας συνεδρίασης (Κείμενο Συνεδρίασης / Συνάντησης) είναι subject:{html, tags}, όπως το schoolLifeBook.
 * Ετικέτες των Προσωπικών Σημειώσεων, του Βιβλίου Σχολικής Ζωής και των συνεδριάσεων: tags:[{type, id}…] σε κάθε
 * προσωπική σημείωση, στην καταχώρηση του Βιβλίου κάθε ημέρας και στο κείμενο κάθε συνεδρίασης (ή κενή λίστα),
 * ανεξάρτητα, με τους ελέγχους του _host_tags.js
 * (φορτώνεται μετά από αυτό· το χρησιμοποιεί τη στιγμή της κλήσης). Το school-calendar:save δέχεται και προαιρετικό
 * tags, το μητρώο ετικετών του έτους, που αντικαθιστά το tagsByYear[year] στην ίδια αποθήκευση.
 */
(() => {
  'use strict';
  const D = window.SchoolDate;
  if (!D) throw Error('Το _host_calendar.js χρειάζεται το _data.js, φορτωμένο πριν από αυτό. Βεβαιώσου ότι το index.html είναι η τελευταία έκδοση.');

  const APP = 'school_calendar.html';
  // Όρια: πιάνουν λάθη εφαρμογών, όχι πραγματικά δεδομένα (ένα σχολικό έτος έχει έως 366 ημέρες).
  const LIMITS = Object.freeze({notes: 366, html: 200000, name: 300, id: 200, people: 300,
    events: 100, scores: 250, pointsMin: -100, pointsMax: 100});
  // Τα Συμβάντα Ποινών / Επιβραβεύσεων στα μηνύματα και στη μορφή του tagUsage (scoreUsage).
  const EVENT_ONE = 'Συμβάν Ποινών / Επιβραβεύσεων', EVENT_MANY = 'Συμβάντα Ποινών / Επιβραβεύσεων';
  const SCORE_TYPES = Object.freeze(['student', 'class']);
  const ZOOM = Object.freeze({min: 70, max: 150, step: 10, fallback: 100});
  const REASONS = Object.freeze(['leave', 'leavePending', 'lesson', 'otherSchool', 'other']);
  const AUTO_REASONS = Object.freeze(['lesson', 'otherSchool']);
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

  const clone = value => structuredClone(value);
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const isText = (value, max) => typeof value === 'string' && value.length <= max;
  const formatDate = iso => D.format(iso);
  const missingTags = 'Λείπει το αρχείο _host_tags.js από τον φάκελο των εφαρμογών. Βεβαιώσου ότι το index.html και τα κοινά αρχεία είναι η τελευταία έκδοση.';
  const hostTags = () => window.SchoolHostTags || null;
  const missingHtml = 'Λείπει ο καθαρισμός κειμένου (SchoolHtml) του _data.js. Βεβαιώσου ότι το index.html και τα κοινά αρχεία είναι η τελευταία έκδοση.';
  const recordsOf = (data, field, year) => {
    const value = isObject(data?.[field]) ? data[field][year] : null;
    const list = field === 'classesByYear' ? value?.classes : value?.students;
    return Array.isArray(list) ? list.filter(isObject) : [];
  };

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

  // school-calendar:context: το Προσωπικό και το Ημερολόγιο του έτους, και το ζουμ. Για τις ετικέτες των
  // Προσωπικών Σημειώσεων, του Βιβλίου Σχολικής Ζωής και των συνεδριάσεων: το μητρώο (tags), η χρήση των γενικών ετικετών
  // (tagUsage), τα Τμήματα, οι Μαθητές και τα όρια (limits).
  function context(data, revision) {
    const year = data.school.year, H = hostTags();
    const classes = isObject(data?.classesByYear) && Array.isArray(data.classesByYear[year]?.classes) ? data.classesByYear[year].classes : [];
    const students = isObject(data?.studentsByYear) && Array.isArray(data.studentsByYear[year]?.students) ? data.studentsByYear[year].students : [];
    return clone({
      revision, school: {...data.school}, year,
      staff: Array.isArray(data?.staffByYear?.[year]) ? data.staffByYear[year] : [],
      calendar: yearData(data, year),
      zoom: zoom(data),
      zoomLimits: {min: ZOOM.min, max: ZOOM.max, step: ZOOM.step},
      tags: H ? H.yearTags(data, year) : {general: [], colors: {}},
      tagUsage: H ? H.usage(data, year).general : {},
      classes, students,
      limits: {
        ...(H ? {tags: H.LIMITS.general, tagsPerItem: H.LIMITS.perItem, warnRatio: H.LIMITS.warnRatio} : {tags: 100, tagsPerItem: 40, warnRatio: 0.9}),
        eventsPerDay: LIMITS.events, scoresPerEvent: LIMITS.scores, pointsMin: LIMITS.pointsMin, pointsMax: LIMITS.pointsMax
      }
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
  // Ετικέτες ενός στοιχείου (σημείωση, Βιβλίο, κείμενο συνεδρίασης): κενή λίστα χωρίς το _host_tags.js.
  function validTags(tags, known, where) {
    if (tags == null || (Array.isArray(tags) && !tags.length)) return [];
    const H = hostTags();
    if (!H) throw Error(missingTags);
    return H.validateRefs(tags, known, where, APP);
  }
  // Το κείμενο μιας συνεδρίασης: {html, tags}, όπως το schoolLifeBook. Χωρίς κείμενο μένει κενό, χωρίς ετικέτες.
  function validateSubject(subject, when, ssd, known) {
    if (subject == null) return {html: '', tags: []};
    if (!isObject(subject) || !isText(subject.html ?? '', LIMITS.html)) throw Error('Μη έγκυρο κείμενο στη συνεδρίαση της ' + when + '. Βεβαιώσου ότι το school_calendar.html είναι η τελευταία έκδοση.');
    const html = subject.html || '';
    return {html, tags: html ? validTags(subject.tags, known, (ssd ? 'στη συνεδρίαση ΣΣΔ' : 'στην παιδαγωγική συνάντηση') + ' της ' + when) : []};
  }
  function validateMeeting(meeting, key, ssd, ids, known) {
    const when = formatDate(key);
    if (!isObject(meeting)) throw Error('Μη έγκυρη συνεδρίαση στις ' + when + '.');
    if (!TIME.test(meeting.startTime || '') || !TIME.test(meeting.endTime || '')) throw Error('Μη έγκυρη ώρα στη συνεδρίαση της ' + when + ' (μορφή HH:MM).');
    if (!(meeting.startTime < meeting.endTime)) throw Error('Η ώρα λήξης της συνεδρίασης της ' + when + ' δεν είναι μετά την ώρα έναρξης.');
    if (meeting.directorName != null && !isText(meeting.directorName, LIMITS.name)) throw Error('Μη έγκυρο κείμενο στη συνεδρίαση της ' + when + '.');
    const subject = validateSubject(meeting.subject, when, ssd, known);
    if (meeting.directorId) checkPerson(meeting.directorId, ids, when);
    const present = idList(meeting.present, 'Παρόντες', when, ids), absent = idList(meeting.absent, 'Απόντες', when, ids);
    if (present.some(id => absent.includes(id))) throw Error('Ένας εκπαιδευτικός είναι και στους Παρόντες και στους Απόντες στη συνεδρίαση της ' + when + '.');
    const out = {
      startTime: meeting.startTime, endTime: meeting.endTime,
      subject, directorId: meeting.directorId || '', directorName: meeting.directorName || '',
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
  // Ένα Συμβάν Ποινών / Επιβραβεύσεων. eventIds: τα id των συμβάντων του έτους (μοναδικά σε όλο το έτος)·
  // people: {student:Set, class:Set} ή null (χωρίς έλεγχο ύπαρξης).
  function validateEvent(event, key, eventIds, known, people) {
    const when = formatDate(key), H = window.SchoolHtml;
    if (!isObject(event)) throw Error('Μη έγκυρο συμβάν Ποινών / Επιβραβεύσεων στις ' + when + '. Βεβαιώσου ότι το school_calendar.html είναι η τελευταία έκδοση.');
    if (!isText(event.id, LIMITS.id) || !event.id) throw Error('Μη έγκυρη ταυτότητα συμβάντος στις ' + when + '. Βεβαιώσου ότι το school_calendar.html είναι η τελευταία έκδοση.');
    if (eventIds.has(event.id)) throw Error('Διπλή ταυτότητα συμβάντος Ποινών / Επιβραβεύσεων στις ' + when + ' (υπάρχει ήδη στο σχολικό έτος). Βεβαιώσου ότι το school_calendar.html είναι η τελευταία έκδοση.');
    eventIds.add(event.id);
    if (!isText(event.html, LIMITS.html)) throw Error('Μη έγκυρη περιγραφή συμβάντος στις ' + when + '. Βεβαιώσου ότι το school_calendar.html είναι η τελευταία έκδοση.');
    if (!H) throw Error(missingHtml);
    const html = H.sanitize(event.html);
    if (!H.hasText(html)) throw Error('Ένα συμβάν Ποινών / Επιβραβεύσεων στις ' + when + ' δεν έχει περιγραφή. Η περιγραφή είναι υποχρεωτική.');
    const tags = validTags(event.tags, known, 'στο συμβάν Ποινών / Επιβραβεύσεων της ' + when);
    const list = event.scores ?? [];
    if (!Array.isArray(list)) throw Error('Μη έγκυρη βαθμολογία στο συμβάν της ' + when + '. Βεβαιώσου ότι το school_calendar.html είναι η τελευταία έκδοση.');
    if (list.length > LIMITS.scores) throw Error('Ένα συμβάν στις ' + when + ' έχει ' + list.length + ' συμμετέχοντες, πάνω από το όριο των ' + LIMITS.scores + ' ανά συμβάν. Η αποθήκευση δεν έγινε.');
    const seen = new Set(), scores = [];
    for (const score of list) {
      if (!isObject(score) || !SCORE_TYPES.includes(score.type) || !isText(score.id, LIMITS.id) || !score.id || !Object.prototype.hasOwnProperty.call(score, 'points'))
        throw Error('Μη έγκυρη ή ελλιπής βαθμολογική εγγραφή στο συμβάν της ' + when + '. Βεβαιώσου ότι το school_calendar.html είναι η τελευταία έκδοση.');
      if (people && !people[score.type].has(score.id)) throw Error('Το συμβάν της ' + when + ' βαθμολογεί ' + (score.type === 'student' ? 'μαθητή που δεν υπάρχει στους «Μαθητές»' : 'τμήμα που δεν υπάρχει στα «Τμήματα»') + ' του σχολικού έτους.');
      const pair = score.type + '\u0001' + score.id;
      if (seen.has(pair)) throw Error((score.type === 'student' ? 'Ο ίδιος μαθητής' : 'Το ίδιο τμήμα') + ' υπάρχει δύο φορές στη βαθμολογία του ίδιου συμβάντος στις ' + when + '.');
      seen.add(pair);
      const points = score.points;
      // null: δεν αποφασίστηκε ακόμη. Μόνο πραγματικοί ακέραιοι αριθμοί, χωρίς καμία μετατροπή (όχι «5», 1.5, true).
      if (points !== null && !(typeof points === 'number' && Number.isInteger(points)))
        throw Error('Οι βαθμοί στο συμβάν της ' + when + ' πρέπει να είναι ακέραιος αριθμός ή χωρίς βαθμολογία ακόμη.');
      if (points !== null && (points < LIMITS.pointsMin || points > LIMITS.pointsMax))
        throw Error('Οι βαθμοί στο συμβάν της ' + when + ' πρέπει να είναι από ' + LIMITS.pointsMin + ' έως ' + LIMITS.pointsMax + '.');
      scores.push({type: score.type, id: score.id, points: points === null ? null : points + 0});
    }
    return {id: event.id, html, tags, scores};
  }
  // Τα δεδομένα του Ημερολογίου για ένα έτος. Απορρίπτει ό,τι θα χαλούσε τα δεδομένα· επιστρέφει καθαρό
  // αντίγραφο (οι κενές σημειώσεις και οι καταχωρήσεις του Βιβλίου χωρίς κείμενο δεν κρατιούνται, ακόμη κι αν
  // έχουν ετικέτες). staff: το Προσωπικό του έτους, για τα id των συνεδριάσεων.
  // known: τα id που μπορεί να έχει μια ετικέτα (SchoolHostTags.known)· χωρίς αυτό ελέγχεται μόνο η μορφή.
  // people: {students, classes} του έτους, για τους βαθμολογούμενους των συμβάντων· χωρίς αυτό ελέγχεται μόνο η μορφή.
  function validateCalendar(calendar, year, staff, known = null, people = null) {
    const ids = new Set((Array.isArray(staff) ? staff : []).map(person => person?.id).filter(Boolean));
    const idSet = list => new Set((Array.isArray(list) ? list : []).filter(item => isObject(item) && typeof item.id === 'string' && item.id).map(item => item.id));
    const participants = people ? {student: idSet(people.students), class: idSet(people.classes)} : null;
    const eventIds = new Set();
    if (!isObject(calendar)) throw Error('Μη έγκυρα δεδομένα Ημερολογίου. Βεβαιώσου ότι το school_calendar.html είναι η τελευταία έκδοση.');
    const out = {entries: {}, ssdMeetings: {}, pedagogicMeetings: {}};
    const entries = calendar.entries ?? {};
    if (!isObject(entries)) throw Error('Μη έγκυρες σημειώσεις Ημερολογίου.');
    for (const [key, entry] of Object.entries(entries)) {
      checkDate(key, year, 'σημειώσεων');
      if (!isObject(entry) || !Array.isArray(entry.personalNotes ?? []) || !isObject(entry.schoolLifeBook ?? {}) || !isText(entry.schoolLifeBook?.html ?? '', LIMITS.html) || !Array.isArray(entry.behaviorEvents ?? []))
        throw Error('Μη έγκυρες σημειώσεις στις ' + formatDate(key) + '.');
      const list = entry.personalNotes ?? [];
      if (list.length > LIMITS.notes) throw Error('Υπερβολικά πολλές σημειώσεις στις ' + formatDate(key) + '.');
      const seen = new Set(), personalNotes = [];
      for (const note of list) {
        if (!isObject(note) || !isText(note.id, LIMITS.id) || !note.id || !isText(note.html, LIMITS.html) || seen.has(note.id))
          throw Error('Μη έγκυρη ή διπλή προσωπική σημείωση στις ' + formatDate(key) + '.');
        seen.add(note.id);
        if (!note.html) continue;
        const tags = validTags(note.tags, known, 'στην προσωπική σημείωση της ' + formatDate(key));
        personalNotes.push({id:note.id, html:note.html, tags});
      }
      const book = entry.schoolLifeBook || {};
      const bookTags = validTags(book.tags, known, 'στο Βιβλίο Σχολικής Ζωής της ' + formatDate(key));
      const schoolLifeBook = {html:book.html || '', tags:book.html ? bookTags : []};
      const events = entry.behaviorEvents ?? [];
      if (events.length > LIMITS.events) throw Error('Οι Ποινές / Επιβραβεύσεις της ' + formatDate(key) + ' θα είχαν ' + events.length + ' συμβάντα, πάνω από το όριο των ' + LIMITS.events + ' ανά ημέρα. Η αποθήκευση δεν έγινε.');
      const behaviorEvents = events.map(event => validateEvent(event, key, eventIds, known, participants));
      // Η ημέρα μένει όταν έχει περιεχόμενο σε μία τουλάχιστον ενότητα (και μόνο συμβάντα).
      if (personalNotes.length || schoolLifeBook.html || behaviorEvents.length) out.entries[key] = {personalNotes, schoolLifeBook, behaviorEvents};
    }
    for (const [field, ssd] of [['ssdMeetings', true], ['pedagogicMeetings', false]]) {
      const meetings = calendar[field] ?? {};
      if (!isObject(meetings)) throw Error('Μη έγκυρες συνεδριάσεις Ημερολογίου.');
      for (const [key, meeting] of Object.entries(meetings)) {
        checkDate(key, year, ssd ? 'συνεδρίασης ΣΣΔ' : 'παιδαγωγικής συνάντησης');
        out[field][key] = validateMeeting(meeting, key, ssd, ids, known);
      }
    }
    const acts = new Map();
    for (const [key, meeting] of Object.entries(out.ssdMeetings).sort(([a], [b]) => a.localeCompare(b))) {
      if (acts.has(meeting.actNumber)) throw Error('Ο αριθμός πράξης ' + meeting.actNumber + ' υπάρχει στις ' + formatDate(acts.get(meeting.actNumber)) + ' και στις ' + formatDate(key) + '.');
      acts.set(meeting.actNumber, key);
    }
    return out;
  }
  // Το school-calendar:save σε αντίγραφο του data: αντικαθιστά μόνο το calendarByYear[year] και, όταν το μήνυμα έχει
  // tags, το tagsByYear[year] (οι γενικές ετικέτες που αφαιρέθηκαν φεύγουν από τα δεδομένα όλων των εφαρμογών). Οι
  // ετικέτες των σημειώσεων ελέγχονται με το νέο μητρώο. Τα υπόλοιπα έτη και τα άγνωστα πεδία του έτους μένουν.
  function applySave(data, message) {
    const year = data.school.year, staff = Array.isArray(data?.staffByYear?.[year]) ? data.staffByYear[year] : [];
    const candidate = clone(data), H = hostTags();
    let sent = message.calendar;
    if (message.tags !== undefined) {
      if (!H) throw Error(missingTags);
      // The general tags removed from the registry leave every note, also the notes of this save.
      const removed = H.applyRegistry(candidate, year, message.tags, APP);
      if (removed.length && isObject(sent)) {
        sent = clone(sent);
        H.removeRefs({calendarByYear: {[year]: sent}}, year, 'general', removed);
      }
    }
    const people = {students: recordsOf(candidate, 'studentsByYear', year), classes: recordsOf(candidate, 'classesByYear', year)};
    const calendar = validateCalendar(sent, year, staff, H ? H.known(candidate, year) : null, people);
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

  // ---- Βαθμολογίες των συμβάντων ----
  function eventsOf(data, year) {
    const value = isObject(data?.calendarByYear) ? data.calendarByYear[year] : null, out = [];
    for (const entry of Object.values(isObject(value?.entries) ? value.entries : {})) {
      for (const event of Array.isArray(entry?.behaviorEvents) ? entry.behaviorEvents : []) if (isObject(event)) out.push(event);
    }
    return out;
  }
  // Σε πόσα συμβάντα του έτους (αποθηκευμένα δεδομένα) βαθμολογείται κάθε μαθητής και τμήμα, με points ή null.
  function scoreUsage(data, year) {
    const counts = {student: new Map(), class: new Map()};
    for (const event of eventsOf(data, year)) {
      const seen = new Set();
      for (const score of Array.isArray(event.scores) ? event.scores : []) {
        if (!isObject(score) || !SCORE_TYPES.includes(score.type) || typeof score.id !== 'string' || seen.has(score.type + '\u0001' + score.id)) continue;
        seen.add(score.type + '\u0001' + score.id);
        counts[score.type].set(score.id, (counts[score.type].get(score.id) || 0) + 1);
      }
    }
    const out = {student: {}, class: {}};
    for (const type of SCORE_TYPES) for (const [id, count] of counts[type]) out[type][id] = [{app: APP, one: EVENT_ONE, many: EVENT_MANY, count}];
    return out;
  }
  // Οι μαθητές ή τα τμήματα που διαγράφηκαν φεύγουν από τη βαθμολογία των συμβάντων· το συμβάν, η περιγραφή, οι
  // ετικέτες και οι βαθμοί των υπόλοιπων μένουν όπως είναι.
  function removeScores(data, year, type, ids) {
    const removed = new Set(ids || []);
    if (!removed.size || !SCORE_TYPES.includes(type)) return 0;
    let count = 0;
    for (const event of eventsOf(data, year)) {
      if (!Array.isArray(event.scores)) continue;
      const kept = event.scores.filter(score => !(isObject(score) && score.type === type && removed.has(score.id)));
      if (kept.length !== event.scores.length) { count += event.scores.length - kept.length; event.scores = kept; }
    }
    return count;
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
    APP, LIMITS, ZOOM, REASONS, EVENT_ONE, EVENT_MANY, yearData, context, validateCalendar, applySave, zoom, withZoom, removeStaff,
    scoreUsage, removeScores, install
  });
})();
