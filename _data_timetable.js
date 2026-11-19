/*
 * Εφαρμογές σχολείου — Κοινές λειτουργίες δεδομένων: CSV, FET, προγράμματα
 * Έκδοση αρχείου: 0.15
 * Όνομα κατά την εγκατάσταση: _data_timetable.js
 *
 * Ο κοινός κώδικας δεδομένων είναι σε τέσσερα αρχεία, που φορτώνονται πάντα όλα, με αυτή τη σειρά, μετά το _ui.js
 * και πριν από το δικό τους script (στο index πριν από τα _host_*.js):
 *   <script src="_data.js"></script>
 *   <script src="_data_timetable.js"></script>
 *   <script src="_data_oloimero.js"></script>
 *   <script src="_data_documents.js"></script>
 * Δεν έχουν δικό τους περιβάλλον χρήστη: δεν ανοίγουν διαλόγους και δεν γράφουν στη σελίδα. Κάθε αρχείο ελέγχει ότι
 * φορτώθηκαν πριν από αυτό τα προηγούμενα, και αλλιώς σταματά με μήνυμα που λέει ποιο λείπει.
 * Χρειάζεται το _data.js.
 * Ορίζει:
 *   window.SchoolCsv        ανάγνωση και γραφή CSV (η ανάγνωση είναι στο _data.js), CSV Προσωπικού
 *   window.SchoolFet        ανάγνωση αρχείων FET (XML)
 *   window.SchoolTimetable  προγράμματα (timetablesByYear): είδη, ώρες, περίοδοι, υπεύθυνοι τμημάτων,
 *                           εμφάνιση μαθητών, συγκρούσεις, διαθεσιμότητα,
 *                           αντικαταστάσεις, εισαγωγή από FET, δάσκαλοι και σειρά του Προσωπικού, κανονική γραφή
 *                           τμημάτων, απασχόληση εκπαιδευτικών σε ημερομηνία και ώρα (συνεδριάσεις), Ιστορικό
 *                           προγράμματος, μάθημα δραστηριότητας (και «μάθημα της τάξης» των Ατομικών Προγραμμάτων),
 *                           Ατομικά Προγράμματα (νέο πρόγραμμα, δραστηριότητες από τα κελιά, αντιγραφή ανά
 *                           εκπαιδευτικό, δραστηριότητες στήριξης: supportActivity), σύνθεση περιόδου (composePeriod: Ωρολόγιο, σχέδιο Ολοημέρου και Ατομικά
 *                           Προγράμματα μαζί, με ώρες, συγκρούσεις και ζώνες· oloimeroDiff: σύγκριση Ωρολογίου και
 *                           σχεδίου Ολοημέρου στις ζώνες Ολοημέρου· moveProblems: οι κανόνες μετακίνησης
 *                           δραστηριοτήτων ανά είδος), Επίσημες περίοδοι και Προσχέδια
 *                           περιόδων, αρχική και τρέχουσα κατάσταση προγράμματος (program.initial), διαθέσιμες ώρες
 *                           Ολοημέρου της περιόδου, τα προβλήματα της σύνθεσης για τον χρήστη (compositionProblems),
 *                           αντίγραφο ασφαλείας περιόδου και επαναφορά του. Δεν είναι ακόμη παγωμένο: το
 *                           _data_oloimero.js προσθέτει τα μέλη του Ολοημέρου και τον εισαγωγέα του, και το παγώνει.
 * Τα προγράμματα είναι στη μορφή formatVersion:2: οι δραστηριότητες αναφέρονται στα τμήματα με το id τους
 * (classes), και τα ονόματα μαθητών των αρχείων που δεν είναι τμήματα μπαίνουν στο otherStudents.
 */
(() => {
  'use strict';
  const parts = window.SchoolDataParts;
  if (!parts) throw Error('Λείπει το αρχείο _data.js, που φορτώνεται πριν από το _data_timetable.js. Βεβαιώσου ότι η σελίδα φορτώνει τα _data.js, _data_timetable.js, _data_oloimero.js και _data_documents.js, με αυτή τη σειρά, και ότι είναι η τελευταία έκδοση.');
  parts.needs('_data_timetable.js', ['_data.js']);
  const {BOM, detectDelimiter, parse, quote, weekdayIndex, compareKey, pad, isoValid, schoolYearTeachingEnd,
    isoWeekday, uid, clone, unique, minutes, clock, nowIso, quoted, isObject, dateRangeText, GRADES, GRADE_LABELS,
    gradeKey, gradeName, isGeneralClass, classKey, classCollator, sortClasses, classesById, classGrades,
    classResolver, sortStaff, classSpelling, isGeneralTeacher, sortStaffAlphabetically} = parts;
  // Η oloimeroStudents είναι στο _data_oloimero.js, που φορτώνεται μετά από αυτό: βρίσκεται τη στιγμή της κλήσης
  // (τη χρησιμοποιεί το individualRefresh).
  const oloimeroStudents = (...args) => parts.oloimeroStudents(...args);

  // CSV προσωπικού: εντοπίζει τα πεδία με τις θέσεις τους ώστε τα υπόλοιπα bytes/σχόλια
  // (ακόμη και τα μεταδεδομένα του Designer) να μην επαναδημιουργούνται κατά την ενημέρωση.
  function staffCsvCells(source) {
    const delimiter=detectDelimiter(source),rows=[];let cells=[],start=0,value='',quoted=false,inQuotes=false;
    const finishCell=end=>{cells.push({start,end,value,quoted});value='';quoted=false;start=end+1};
    const finishRow=()=>{rows.push(cells);cells=[]};
    for(let i=0;i<source.length;i++){
      const ch=source[i];
      if(inQuotes){if(ch==='"'){if(source[i+1]==='"'){value+='"';i++}else inQuotes=false}else value+=ch;continue}
      if(ch==='"'&&i===start){inQuotes=true;quoted=true;continue}
      if(ch===delimiter){finishCell(i);continue}
      if(ch==='\r'||ch==='\n'){
        const end=i;finishCell(end);finishRow();if(ch==='\r'&&source[i+1]==='\n')i++;start=i+1;continue
      }
      value+=ch;
    }
    if(inQuotes)throw Error('Το CSV περιέχει πεδίο με εισαγωγικά που δεν κλείνουν.');
    if(start<source.length||cells.length){finishCell(source.length);finishRow()}
    return rows;
  }
  function staffCsvRead(source) {
    if(typeof source!=='string')throw Error('Μη έγκυρο περιεχόμενο CSV.');
    const rows=staffCsvCells(source),header=rows.find(r=>r.length>1&&r.some(c=>c.value.trim()==='Teachers'));
    if(!header)throw Error('Το CSV δεν έχει στήλη «Teachers».');
    const idx=header.findIndex(c=>c.value.trim()==='Teachers');
    if(header.filter(c=>c.value.trim()==='Teachers').length!==1)throw Error('Το CSV έχει περισσότερες από μία στήλες «Teachers».');
    const names=new Set();let count=0;
    for(const row of rows.slice(rows.indexOf(header)+1)){
      if(row.length===1&&row[0].value.trim()==='# OLOIMERO_DESIGNER_JSON_BEGIN')break;
      if(row.length!==header.length)continue; // σχόλια, κενές γραμμές, μεταδεδομένα
      const cell=row[idx];if(!cell.value.trim())continue;
      count++;
      for(const item of cell.value.split('+'))if(item.trim())names.add(item.trim());
    }
    return {names:[...names],rows:count};
  }
  function staffCsvUpdate(source,mapping) {
    const rows=staffCsvCells(source),header=rows.find(r=>r.length>1&&r.some(c=>c.value.trim()==='Teachers'));
    if(!header||header.filter(c=>c.value.trim()==='Teachers').length!==1)throw Error('Το CSV δεν έχει μοναδική στήλη «Teachers».');
    const idx=header.findIndex(c=>c.value.trim()==='Teachers'),changes=[];let replacements=0;
    for(const row of rows.slice(rows.indexOf(header)+1)){
      if(row.length===1&&row[0].value.trim()==='# OLOIMERO_DESIGNER_JSON_BEGIN')break;
      if(row.length!==header.length)continue;
      const cell=row[idx];if(!cell.value.trim())continue;
      const result=cell.value.split('+').map(part=>{
        const old=part.trim(),target=mapping[old];
        if(!old||typeof target!=='string'||!target.trim()||target===old)return part;
        replacements++;return part.replace(old,target);
      }).join('+');
      if(result!==cell.value)changes.push({start:cell.start,end:cell.end,text:cell.quoted?quote(result):result});
    }
    let output=source;for(const c of changes.reverse())output=output.slice(0,c.start)+c.text+output.slice(c.end);
    return {text:output,replacements};
  }
  // Ακριβές όνομα ή μοναδικό πρόθεμα που τελειώνει σε « - ...»· χωρίς αυθαίρετη επιλογή.
  function staffCsvSuggest(names,staff) {
    const current=staff.map(p=>String(p.shortName||'').trim()).filter(Boolean),out={};
    for(const name of names){
      const exact=current.filter(n=>n===name);
      if(exact.length===1){out[name]=exact[0];continue}
      const more=current.filter(n=>n.startsWith(name+' - '));
      out[name]=more.length===1?more[0]:'';
    }
    return out;
  }

  // ---- FET ----
  const child = (node, tag) => node ? [...node.children].find(item => item.tagName === tag) : undefined;
  const children = (node, tag) => node ? [...node.children].filter(item => item.tagName === tag) : [];
  // Το κείμενο του άμεσου παιδιού tag (ή κενό). Χωρίς trim: όπου χρειάζεται, το κάνει η εφαρμογή.
  const text = (node, tag) => child(node, tag)?.textContent || '';

  // Ανάλυση αρχείου FET. Ελέγχει ότι είναι XML με ρίζα <fet> και ότι έχει ως άμεσα παιδιά της ρίζας
  // τις λίστες του options.require (π.χ. ['Teachers_List']). Αλλιώς πετά λάθος με το options.message.
  function parseFet(xml, options = {}) {
    const doc = new DOMParser().parseFromString(String(xml ?? '').replace(BOM, ''), 'application/xml');
    const root = doc.documentElement;
    if (doc.querySelector('parsererror') || root?.tagName !== 'fet' || (options.require || []).some(tag => !child(root, tag))) {
      throw Error(options.message || 'Το αρχείο δεν είναι έγκυρο αρχείο FET.');
    }
    return doc;
  }

  // =============================================================================================
  // ---- Προγράμματα ----
  // =============================================================================================

  // Κατάλογος ειδών προγραμμάτων. Τα δικαιώματα εγγραφής και οι validators του source μένουν στο host.
  //   owner: η εφαρμογή-κάτοχος (null: δεν υπάρχει ακόμη)· ownerTitle: το όνομά της για τον χρήστη·
  //   counts: μετρά στις ώρες και στη διαθεσιμότητα· history: κρατά Ιστορικό (program.history)·
  //   κάθε πρόγραμμα ανήκει πάντα σε περίοδο (δεν υπάρχουν προσχέδια προγραμμάτων χωρίς περίοδο)·
  //   importers: οι εισαγωγείς του είδους (βλέπε «Εισαγωγείς» παρακάτω)· κενό όταν δεν υπάρχει εισαγωγή.
  //   zone: η ζώνη της ημέρας που δίνει το είδος στη σύνθεση της περιόδου (composePeriod): 'morning' (Πρωινό) ή
  //   'oloimero' (Πρωινή Ζώνη, Γεύμα, Ολοήμερο, Διευρυμένο)· support: οι δραστηριότητές του μπορεί να είναι στήριξη
  //   (δεν συγκρούονται στους μαθητές και δεν είναι μαθήματα της τάξης), με τον κανόνα του supportActivity· exclusive: μια ώρα του είδους είναι μόνο του
  //   εκπαιδευτικού της: καμία άλλη δραστηριότητα του ίδιου εκπαιδευτικού την ίδια ώρα, σε καμία λειτουργία
  //   (βλέπε moveProblems).
  //   initialSource: τα κλειδιά του source που ανήκουν στην κατάσταση του προγράμματος, μαζί με τις δραστηριότητες,
  //   για την αρχική και την τρέχουσα κατάσταση (βλέπε «Αρχική και τρέχουσα κατάσταση»).
  // Νέο είδος: μια εγγραφή εδώ (με εισαγωγέα, αν η εφαρμογή του εξάγει αρχείο), και στο host τα
  // δικαιώματα και ο validator του source.
  // Ο εισαγωγέας του Ολοημέρου μπαίνει στο oloimero.importers από το _data_oloimero.js, που μετά παγώνει τη λίστα.
  const KINDS = Object.freeze({
    school: Object.freeze({label: 'Ωρολόγιο', owner: 'fet_timetable_editor.html', ownerTitle: 'Πλήρες Σχολικό Πρόγραμμα', counts: true, history: true, zone: 'morning', support: false, exclusive: false, initialSource: Object.freeze(['unavailable']), importers: Object.freeze([fetImporter()])}),
    oloimero: Object.freeze({label: 'Ολοήμερο', owner: 'oloimero_designer.html', ownerTitle: 'Ολοήμερο Designer', counts: false, history: true, zone: 'oloimero', support: false, exclusive: false, initialSource: Object.freeze(['placements', 'pending', 'design']), importers: []}),
    individual: Object.freeze({label: 'Ατομικά Προγράμματα', owner: 'individual_programs.html', ownerTitle: 'Ατομικά Προγράμματα', counts: true, history: true, zone: 'morning', support: true, exclusive: true, initialSource: Object.freeze(['placements', 'pending']), importers: Object.freeze([])})
  });
  const countsInHours = kind => !!KINDS[kind]?.counts;
  // Οι εισαγωγείς ενός είδους, και ένας συγκεκριμένος εισαγωγέας (ή null).
  const importersOf = kind => KINDS[kind]?.importers || [];
  const importerOf = (kind, id) => importersOf(kind).find(item => item.id === id) || null;

  // Χαρακτηρισμοί των Ωρών Διδασκαλίας, με τη σειρά τους μέσα στη μέρα.
  const HOUR_GROUPS = Object.freeze(['early', 'morning', 'meal', 'afternoon', 'extended', 'break']);
  const DAY_KEYS = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri']);
  const DAY_LABELS = Object.freeze(['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή']);

  // Διαθεσιμότητα: οι δύο σταθερές του κανόνα.
  const STAY_MINUTES = 6 * 60;          // 6 ώρες παραμονής στο σχολείο
  const EARLY_ARRIVAL_MINUTES = 15;     // άφιξη 15 λεπτά νωρίτερα από την πρώτη ζώνη

  // ---- Ώρες ----
  // Χρονικό διάστημα «HH:MM-HH:MM» (και «H:MM», με «-», «–», «—», «−» και κενά) → {start, end}, ή null.
  function parseTimeRange(value) {
    const match = /^\s*(\d{1,2})[:.](\d{2})\s*[-–—−]\s*(\d{1,2})[:.](\d{2})\s*$/.exec(String(value ?? ''));
    if (!match) return null;
    const [h1, m1, h2, m2] = match.slice(1).map(Number);
    if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
    const start = pad(h1) + ':' + pad(m1), end = pad(h2) + ':' + pad(m2);
    return start < end ? {start, end} : null;
  }
  // Πραγματικές ώρες μιας ώρας των Ωρών Διδασκαλίας: από το name, αλλιώς από το longName.
  function hourTimes(hour) { return parseTimeRange(hour?.name) || parseTimeRange(hour?.longName); }

  // Οι ώρες των Ωρών Διδασκαλίας με τις πραγματικές τους ώρες ({hour, name, category, fetTag, start, end}),
  // με τη σειρά τους. Πετά λάθος για ώρα που δεν διαβάζεται ως «HH:MM-HH:MM».
  function timedHours(teachingHours) {
    const hours = teachingHours?.hours || [];
    if (!hours.length) throw Error('Δεν έχουν καταχωριστεί Ώρες Διδασκαλίας για το σχολικό έτος. Συμπλήρωσέ τες πρώτα στις «Ώρες Διδασκαλίας».');
    return hours.map(hour => {
      const times = hourTimes(hour);
      if (!times) throw Error('Η ώρα ' + quoted(hour.name) + ' των Ωρών Διδασκαλίας δεν έχει χρονικό διάστημα «HH:MM-HH:MM» ούτε στο όνομα ούτε στην περιγραφή. Διόρθωσέ την στις «Ώρες Διδασκαλίας».');
      return {hour, name: String(hour.name).trim(), category: hour.category || '', fetTag: String(hour.fetTag || '').trim(), ...times};
    });
  }

  // Ώρες ανά χαρακτηρισμό: {early:[…], morning:[…], …}, κάθε ομάδα με τη σειρά των Ωρών Διδασκαλίας.
  function hourGroups(teachingHours) {
    const groups = Object.fromEntries(HOUR_GROUPS.map(key => [key, []]));
    for (const item of timedHours(teachingHours)) if (groups[item.category]) groups[item.category].push(item);
    return groups;
  }

  // ---- Περίοδοι ----
  // Μια περίοδος είναι Επίσημη (status 'official', ή χωρίς status) ή Προσχέδιο περιόδου (status 'draft'). Ένα
  // Προσχέδιο περιόδου λειτουργεί σαν κανονική περίοδος μέσα στα Σχολικά Προγράμματα, χωρίς ημερομηνίες (τις αποκτά
  // με τον «Ορισμό ως Επίσημης»)· δεν ισχύει σε καμία ημερομηνία (periodAt, programAt, programsAt, staffBusyAt), δεν μπαίνει στις
  // επικαλύψεις, και δεν το βλέπουν οι εφαρμογές που μόνο διαβάζουν προγράμματα (το φιλτράρει το host).
  const PERIOD_STATUSES = Object.freeze(['official', 'draft']);
  const isDraftPeriod = period => period?.status === 'draft';
  // Οι Επίσημες περίοδοι μιας λίστας, με τη σειρά της λίστας.
  const officialPeriods = periods => (Array.isArray(periods) ? periods : []).filter(period => isObject(period) && !isDraftPeriod(period));
  // Κενή λήξη: 15 Ιουνίου του σχολικού έτους της έναρξης. Το αποθηκευμένο `to` μένει κενό.
  // Χωρίς ρητό έτος, η έναρξη Σεπ.–Δεκ. ανήκει στο έτος που αρχίζει τότε,
  // ενώ η έναρξη Ιαν.–Αύγ. στο σχολικό έτος που άρχισε το προηγούμενο ημερολογιακό έτος.
  function periodEnd(period, year) {
    if (period?.to) return period.to;
    if (!year && isoValid(period?.from)) {
      const start = Number(period.from.slice(0, 4));
      const beginning = Number(period.from.slice(5, 7)) >= 9 ? start : start - 1;
      year = beginning + '-' + (beginning + 1);
    }
    return schoolYearTeachingEnd(year);
  }
  // Ισχύει η περίοδος στην ημερομηνία; το άκρο είναι συμπεριληπτικό.
  const periodCovers = (period, date) => isoValid(period?.from) && isoValid(date) && date >= period.from && date <= periodEnd(period);
  const periodCollator = new Intl.Collator('el', {sensitivity: 'base', numeric: true});
  const periodByName = (a, b) => periodCollator.compare(String(a?.name ?? '').trim(), String(b?.name ?? '').trim()) || String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  const periodStart = period => isoValid(period?.from) ? period.from : '9999-99-99';

  // Η σειρά των περιόδων, αυτόματη (δεν αποθηκεύεται και δεν αλλάζει από τον χρήστη): πρώτα οι Επίσημες κατά
  // ημερομηνία έναρξης (με ίδια έναρξη κατά λήξη, και μετά αλφαβητικά), μετά τα Προσχέδια περιόδων αλφαβητικά.
  // Επιστρέφει νέο πίνακα· η αποθηκευμένη λίστα μένει όπως είναι.
  function sortPeriods(periods) {
    const list = (Array.isArray(periods) ? periods : []).filter(isObject);
    const official = list.filter(period => !isDraftPeriod(period)).sort((a, b) => {
      const fa = periodStart(a), fb = periodStart(b);
      if (fa !== fb) return fa < fb ? -1 : 1;
      const ea = periodEnd(a), eb = periodEnd(b);
      if (ea !== eb) return ea < eb ? -1 : 1;
      return periodByName(a, b);
    });
    return [...official, ...list.filter(isDraftPeriod).sort(periodByName)];
  }
  // Ο αύξων αριθμός κάθε περιόδου, ξεχωριστά στις Επίσημες και στα Προσχέδια περιόδων (η θέση της στην ομάδα της,
  // με τη σειρά του sortPeriods, από 1): Map(id → αριθμός).
  function periodNumbers(periods) {
    const numbers = new Map(), counts = {official: 0, draft: 0};
    for (const period of sortPeriods(periods)) numbers.set(period.id, ++counts[isDraftPeriod(period) ? 'draft' : 'official']);
    return numbers;
  }
  // Ποια από δύο Επίσημες περιόδους που επικαλύπτονται ισχύει: αυτή που ξεκινά αργότερα· με ίδια έναρξη, αυτή που
  // λήγει αργότερα· με ίδια και τη λήξη, αυτή που είναι πρώτη αλφαβητικά. → true όταν ισχύει η a.
  function periodPrevails(a, b) {
    if (a.from !== b.from) return a.from > b.from;
    const ea = periodEnd(a), eb = periodEnd(b);
    if (ea !== eb) return ea > eb;
    return periodByName(a, b) < 0;
  }

  // Η Επίσημη περίοδος που ισχύει σε μια ημερομηνία (σε επικάλυψη, με τον κανόνα του periodPrevails), ή null.
  function periodAt(periods, date) {
    let found = null;
    for (const period of officialPeriods(periods)) if (periodCovers(period, date) && (!found || periodPrevails(period, found))) found = period;
    return found;
  }
  // Το πρόγραμμα ενός είδους που ισχύει σε μια ημερομηνία (timetables = timetablesByYear[year]), ή null.
  function programAt(timetables, kind, date) {
    const period = periodAt(timetables?.periods, date);
    return period ? (timetables.programs || []).find(program => program.kind === kind && program.periodId === period.id) || null : null;
  }
  // Όλα τα προγράμματα που ισχύουν σε μια ημερομηνία, ένα ανά είδος.
  function programsAt(timetables, date) {
    const period = periodAt(timetables?.periods, date);
    return period ? (timetables.programs || []).filter(program => program.periodId === period.id) : [];
  }

  // Προειδοποιήσεις για τη λίστα περιόδων (δεν εμποδίζουν την αποθήκευση), με τη σειρά του sortPeriods:
  //   order: «έως» πριν από το «από»· openEnd: κενό «έως» σε Επίσημη περίοδο που δεν είναι η τελευταία Επίσημη·
  //   overlap: επικάλυψη δύο Επίσημων περιόδων, με την περίοδο που ισχύει· sameStart: δύο Επίσημες περίοδοι που
  //   ξεκινούν την ίδια ημέρα (μαζί με το overlap), με την περίοδο που ισχύει και τον λόγο.
  // Τα Προσχέδια περιόδων δεν μπαίνουν στις επικαλύψεις. Κάθε προειδοποίηση: {type, periodIds, message}.
  function periodWarnings(periods) {
    const list = sortPeriods(periods), official = list.filter(period => !isDraftPeriod(period)), warnings = [];
    for (const period of list) if (period.to && period.from && period.to < period.from) warnings.push({type: 'order', periodIds: [period.id], message: 'Η περίοδος ' + quoted(period.name) + ' λήγει πριν αρχίσει.'});
    official.forEach((period, index) => {
      if (!period.to && index < official.length - 1) warnings.push({type: 'openEnd', periodIds: [period.id], message: 'Η περίοδος ' + quoted(period.name) + ' δεν έχει ημερομηνία λήξης, αλλά δεν είναι η τελευταία Επίσημη περίοδος.'});
    });
    for (let i = 0; i < official.length; i++) for (let j = i + 1; j < official.length; j++) {
      const a = official[i], b = official[j];
      if (!isoValid(a.from) || !isoValid(b.from) || (a.to && a.to < a.from) || (b.to && b.to < b.from)) continue;
      const from = a.from > b.from ? a.from : b.from;
      const endA = periodEnd(a), endB = periodEnd(b);
      const to = endA < endB ? endA : endB;
      if (!to || to < from) continue;
      const winner = periodPrevails(a, b) ? a : b;
      warnings.push({type: 'overlap', periodIds: [a.id, b.id], from, to, message: 'Οι περίοδοι ' + quoted(a.name) + ' και ' + quoted(b.name) + ' επικαλύπτονται: ' + (to ? 'στις ' : '') + dateRangeText(from, to) + ' ισχύει η ' + quoted(winner.name) + '.'});
      if (a.from === b.from) {
        const why = endA !== endB ? 'λήγει αργότερα' : 'είναι πρώτη αλφαβητικά';
        warnings.push({type: 'sameStart', periodIds: [a.id, b.id], from, message: 'Οι περίοδοι ' + quoted(a.name) + ' και ' + quoted(b.name) + ' ξεκινούν την ίδια ημέρα (' + dateRangeText(from, from) + '): ισχύει η ' + quoted(winner.name) + ', γιατί ' + why + '.'});
      }
    }
    return warnings;
  }

  // ---- Μαθητές μιας δραστηριότητας ----
  // Οι δραστηριότητες κρατούν: classes (id τμημάτων), subsets (υποσύνολα: ονόματα ομάδων του FET, π.χ.
  // «Ε1-Γαλ», και, με τον κανόνα των μεικτών δραστηριοτήτων, τα id των ολόκληρων τμημάτων), otherStudents
  // (ονόματα μαθητών του αρχείου που δεν είναι τμήματα).
  // Συνδυασμός: classes = ολόκληρα τμήματα και τα τμήματα των υποσυνόλων· όταν υπάρχουν υποσύνολα, μπαίνουν
  // στα subsets και τα ολόκληρα τμήματα (και τα υποσύνολά τους, extra), ώστε ο έλεγχος συγκρούσεων να μη
  // χάνει την επικάλυψη στο ολόκληρο τμήμα.
  function combineStudents(whole, subsets, other, extra = () => []) {
    const ids = unique(whole);
    const result = {classes: unique([...ids, ...subsets.map(item => item.classId).filter(Boolean)]), subsets: [], otherStudents: unique(other)};
    if (subsets.length) result.subsets = unique([...subsets.map(item => item.name), ...ids.flatMap(id => [id, ...extra(id)])]);
    return result;
  }

  // Ευρετήριο της ιεραρχίας των μαθητών του FET ([{name, groups:[{name, subgroups:[…]}]}]):
  // όνομα → {type:'year'|'group'|'subgroup', groups:[…], parent}.
  function studentsIndex(hierarchy) {
    const index = new Map(), add = (name, entry) => { if (name && !index.has(name)) index.set(name, entry); };
    const subgroupsOf = new Map();
    for (const year of hierarchy || []) {
      add(year.name, {type: 'year', groups: unique((year.groups || []).map(group => group.name))});
      for (const group of year.groups || []) {
        add(group.name, {type: 'group', groups: [group.name]});
        subgroupsOf.set(group.name, unique([...(subgroupsOf.get(group.name) || []), ...(group.subgroups || [])]));
        for (const subgroup of group.subgroups || []) add(subgroup, {type: 'subgroup', groups: [group.name], parent: group.name});
      }
    }
    return {index, subgroupsOf};
  }

  // «Students Sets» του FET (π.χ. «Β1+Δ'», «Ε1-Γαλ+Ε2-Γαλ», «Α'-Στ'») → {classes, subsets, otherStudents, unknown}.
  //   Οι τάξεις (Years) αναπτύσσονται στα Groups τους με την ιεραρχία του FET, και κάθε Group αντιστοιχίζεται
  //   σε τμήμα με το resolver (όσα τμήματα Γενικής Παιδείας λείπουν δημιουργούνται). Υποσύνολα (Subgroups)
  //   μπαίνουν στα subsets ως κείμενο, με το τμήμα τους στα classes. Groups που δεν είναι τμήματα → otherStudents.
  //   unknown: σύνολα που δεν υπάρχουν στην ιεραρχία (αντιστοιχίζονται κι αυτά με το resolver).
  //   resolver: SchoolClasses.resolver, ή τα τμήματα του έτους.
  function expandStudents(value, hierarchy, resolver) {
    const {index, subgroupsOf} = hierarchy instanceof Map ? {index: hierarchy, subgroupsOf: new Map()} : (hierarchy?.index ? hierarchy : studentsIndex(hierarchy));
    const classes = classResolver(resolver);
    const parts = String(value ?? '').split('+').map(part => part.trim()).filter(Boolean);
    const whole = [], subsets = [], other = [], unknown = [], origin = new Map();
    const remember = (id, name) => { if (id && !origin.has(id)) origin.set(id, name); };
    const add = name => { const id = classes.resolve(name); if (id) { whole.push(id); remember(id, name); } else other.push(name); };
    for (const part of parts) {
      const entry = index.get(part);
      if (!entry) { unknown.push(part); add(part); }
      else if (entry.type === 'subgroup') { const id = classes.resolve(entry.parent); remember(id, entry.parent); subsets.push({name: part, classId: id}); }
      else entry.groups.forEach(add);
    }
    return {...combineStudents(whole, subsets, other, id => subgroupsOf.get(origin.get(id)) || []), unknown: unique(unknown)};
  }

  // Το τμήμα ενός υποσυνόλου από το όνομά του («Ε1-Γαλ»: τμήμα, «-», όνομα) → id ή null. Για τμήμα Γενικής
  // Παιδείας με το κλειδί (ώστε να ισχύει και μετά από μετονομασία, π.χ. «Ε-1»), για άλλο τμήμα με το όνομα.
  function subsetParent(name, classes) {
    const key = compareKey(name);
    const general = /^((?:ΣΤ|[ΑΒΓΔΕ])\d+)[-–_](.+)$/.exec(key);
    if (general) { const id = classes.resolve(general[1]); if (id) return id; }
    const others = classes.classes.filter(record => !isGeneralClass(record)).map(record => ({id: record.id, key: compareKey(record.name)})).filter(item => item.key).sort((a, b) => b.key.length - a.key.length);
    return others.find(item => key.length > item.key.length + 1 && key.startsWith(item.key) && /[-–_]/.test(key[item.key.length]))?.id || null;
  }

  // Ονόματα ομάδων μαθητών χωρίς ιεραρχία του FET (π.χ. του Ολοήμερου Designer: «Α1», «Β'», «Α'-Στ'», «Ε1-Γαλ»,
  // ή «Β1+Δ'») → τα μέρη τους: {grades:['Α', …'Στ'], classIds:[…], subsets:[{name, classId}], other:[…]}.
  //   τάξη («Β'») → grades· εύρος τάξεων («Α'-Στ'») → οι τάξεις του· τμήμα → classIds (με το resolver)·
  //   υποσύνολο («Ε1-Γαλ») → subsets, με το τμήμα του· οτιδήποτε άλλο → other.
  function studentsParts(value, resolver) {
    const classes = classResolver(resolver);
    const parts = (Array.isArray(value) ? value : String(value ?? '').split('+')).map(part => String(part).trim()).filter(Boolean);
    const out = {grades: [], classIds: [], subsets: [], other: []};
    for (const part of parts) {
      const plain = gradeKey(part);
      const grade = /^(ΣΤ|[ΑΒΓΔΕ])$/.exec(plain);
      if (grade) { out.grades.push(gradeName(grade[1])); continue; }
      const range = /^(ΣΤ|[ΑΒΓΔΕ])[-–—](ΣΤ|[ΑΒΓΔΕ])$/.exec(plain);
      if (range) {
        const from = GRADES.indexOf(range[1]), to = GRADES.indexOf(range[2]);
        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) out.grades.push(gradeName(GRADES[i]));
        continue;
      }
      const id = classes.resolve(part);
      if (id) { out.classIds.push(id); continue; }
      const parent = subsetParent(part, classes);
      if (parent) { out.subsets.push({name: part, classId: parent}); continue; }
      out.other.push(part);
    }
    out.grades = unique(out.grades); out.classIds = unique(out.classIds); out.other = unique(out.other);
    out.subsets = out.subsets.filter((item, index) => out.subsets.findIndex(other => other.name === item.name) === index);
    return out;
  }
  // Τα τμήματα μιας τάξης → id· τάξη χωρίς τμήματα → το όνομά της στο other.
  const expandGrade = (classes, grade, whole, other) => {
    const ids = classes.grade(grade);
    if (ids.length) whole.push(...ids); else other.push(GRADE_LABELS[gradeKey(grade)] || String(grade));
  };

  // Ονόματα ομάδων μαθητών χωρίς ιεραρχία (βλέπε studentsParts) → {classes, subsets, otherStudents}: οι τάξεις
  // αναπτύσσονται στα τμήματα που υπάρχουν (τάξη χωρίς τμήματα → otherStudents), με τους κανόνες των
  // μεικτών δραστηριοτήτων. resolver: SchoolClasses.resolver, ή τα τμήματα του έτους.
  function studentsFromNames(value, resolver) {
    const classes = classResolver(resolver), parts = studentsParts(value, classes);
    const whole = [...parts.classIds], other = [...parts.other];
    parts.grades.forEach(grade => expandGrade(classes, grade, whole, other));
    return combineStudents(whole, parts.subsets, other);
  }

  // ---- Εμφάνιση μαθητών ----
  // Το κείμενο που δείχνουν όλες οι εφαρμογές για τους μαθητές μιας δραστηριότητας. Υπολογίζεται από τα
  // classes / subsets / otherStudents και τα Τμήματα (ctx.classes) και δεν αποθηκεύεται. Τα ονόματα από τα Τμήματα.
  //   ένα τμήμα ή ένα υποσύνολο → όπως είναι («Α1», «Ε1-Γαλ»)·
  //   ολόκληρη τάξη → «Β'» (τάξη με ένα μόνο τμήμα → το τμήμα)· μερική τάξη → τα τμήματα («Β1»)·
  //   τρεις ή περισσότερες συνεχόμενες ολόκληρες τάξεις → εύρος («Α'-Γ'», «Α'-Στ'»)· δύο, ή μη
  //   συνεχόμενες, χωριστά («Α', Β'»)· μετά τα άλλα τμήματα (αλφαβητικά), τα υποσύνολα, και στο τέλος τα
  //   otherStudents όπως είναι. Ένα id που δεν υπάρχει στα Τμήματα γράφεται «?». Διαχωριστικό «, ».
  // Τα υποσύνολα που προστέθηκαν μόνο για τον έλεγχο συγκρούσεων (το id ενός ολόκληρου τμήματος και τα
  // υποσύνολά του, που αναγνωρίζονται με το κλειδί του τμήματος) δεν εμφανίζονται.
  function studentsText(activity, ctx = {}) {
    const clean = list => unique((list || []).map(item => String(item ?? '').trim()).filter(Boolean));
    const ids = clean(activity?.classes), subsets = clean(activity?.subsets), other = clean(activity?.otherStudents);
    if (!ids.length && !subsets.length && !other.length) return '';
    const school = (ctx.classes || []).filter(isObject), byId = classesById(school);
    const subsetSet = new Set(subsets), mixed = subsets.length > 0;
    // Ολόκληρα τμήματα: χωρίς υποσύνολα όλα· με υποσύνολα, όσα υπάρχουν και στα subsets.
    const whole = new Set();
    let missing = false;
    for (const id of ids) {
      if (mixed && !subsetSet.has(id)) continue;
      if (byId.has(id)) whole.add(id); else missing = true;
    }
    const grades = classGrades(school), tokens = [];
    for (const {classes: list, index} of grades) {
      const present = list.filter(record => whole.has(record.id));
      if (!present.length) continue;
      if (present.length === list.length) tokens.push({index, full: true, label: list.length === 1 ? list[0].name : GRADE_LABELS[GRADES[index]]});
      else present.forEach(record => tokens.push({index, full: false, label: record.name}));
    }
    // Εύρος: τρεις ή περισσότερες ολόκληρες τάξεις, συνεχόμενες στις τάξεις του σχολείου.
    const order = grades.map(item => item.index), pieces = [];
    for (let i = 0; i < tokens.length;) {
      let j = i;
      while (tokens[i].full && j + 1 < tokens.length && tokens[j + 1].full && order.indexOf(tokens[j + 1].index) === order.indexOf(tokens[j].index) + 1) j++;
      if (tokens[i].full && j - i >= 2) { pieces.push(GRADE_LABELS[GRADES[tokens[i].index]] + '-' + GRADE_LABELS[GRADES[tokens[j].index]]); i = j + 1; }
      else { pieces.push(tokens[i].label); i++; }
    }
    const others = sortClasses(school.filter(record => !isGeneralClass(record) && whole.has(record.id))).map(record => String(record.name ?? ''));
    const prefixes = [...whole].map(id => byId.get(id)).map(record => compareKey(isGeneralClass(record) ? classKey(record) : record.name)).filter(Boolean);
    const shownSubsets = subsets.filter(name => {
      if (byId.has(name) || ids.includes(name)) return false;
      const key = compareKey(name);
      return !prefixes.some(prefix => key.length > prefix.length && key.startsWith(prefix) && /[-–_]/.test(key[prefix.length]));
    });
    return [...pieces, ...others, ...(missing ? ['?'] : []), ...shownSubsets, ...other].join(', ');
  }

  // ---- Μάθημα δραστηριότητας ----
  // Το μάθημα που δείχνουν όλες οι εφαρμογές για μια δραστηριότητα. Χωρίς subjectFromClasses: το subject όπως
  // είναι. Με subjectFromClasses:true (μόνο στο είδος individual, «μάθημα της τάξης»): το μάθημα που κάνουν την
  // ίδια ώρα τα τμήματα της δραστηριότητας. Υπολογίζεται κατά την ανάγνωση, ώστε να μένει σωστό όταν αλλάξει
  // το Ωρολόγιο, και δεν αποθηκεύεται.
  //   ctx: {composition} (η σύνθεση της περιόδου, composePeriod): τα μαθήματα της τάξης στη σύνθεση, δηλαδή οι
  //   δραστηριότητες που δεν είναι στήριξη (το Πρωινό από το Ωρολόγιο, οι ζώνες Ολοημέρου από το σχέδιο Ολοημέρου),
  //   με τις ώρες που μετρούν. Προαιρετικά ctx.classes, για τα ονόματα (αλλιώς τα τμήματα της σύνθεσης). Χωρίς
  //   σύνθεση το «μάθημα της τάξης» δεν είναι γνωστό: κενό κείμενο, χωρίς ομάδες και χωρίς missing.
  //   → {text, groups:[{subjects:[…], classIds:[…]}], missing:[classId…]}
  //   Τα τμήματα με τα ίδια μαθήματα γίνονται μία ομάδα. Μία ομάδα → «Γλώσσα»· περισσότερες →
  //   «Γλώσσα (Β1, Β2), Μαθηματικά (Γ1)». Τμήμα με δύο μαθήματα την ίδια ώρα (π.χ. υποσύνολα) → «Αγγλικά / Γαλλικά».
  //   Τμήμα χωρίς μάθημα εκείνη την ώρα: μόνο στο missing· κανένα μάθημα → κενό κείμενο.
  function activitySubjectDetails(activity, ctx = {}) {
    if (!activity?.subjectFromClasses) return {text: String(activity?.subject ?? '').trim(), groups: [], missing: []};
    if (!ctx.composition) return {text: '', groups: [], missing: []};
    const times = (activity.times || []).filter(isObject);
    // The lessons of the classes: the entries of the composition that are not support, with the times that count.
    const lessons = ctx.composition.entries.filter(entry => !entry.support);
    const byId = classesById(ctx.classes || ctx.composition?.classes || []);
    const ids = unique((activity.classes || []).filter(Boolean));
    const order = new Map(sortClasses(ids.map(id => byId.get(id)).filter(Boolean)).map((record, index) => [record.id, index]));
    ids.sort((a, b) => (order.has(a) ? order.get(a) : Infinity) - (order.has(b) ? order.get(b) : Infinity));
    const groups = new Map(), missing = [];
    for (const id of ids) {
      const subjects = [];
      for (const {activity: other, times: otherTimes} of lessons) {
        if (other === activity || !(other.classes || []).includes(id) || !otherTimes.some(time => times.some(own => timesOverlap(own, time)))) continue;
        const name = String(other.subject ?? '').trim();
        if (name) subjects.push(name);
      }
      if (!subjects.length) { missing.push(id); continue; }
      const sorted = unique(subjects).sort((a, b) => classCollator.compare(a, b)), key = JSON.stringify(sorted);
      if (!groups.has(key)) groups.set(key, {subjects: sorted, classIds: []});
      groups.get(key).classIds.push(id);
    }
    const list = [...groups.values()];
    const subjectText = group => group.subjects.join(' / ');
    const text = list.length === 1 ? subjectText(list[0])
      : list.map(group => `${subjectText(group)} (${group.classIds.map(id => byId.has(id) ? String(byId.get(id).name ?? '') : '?').join(', ')})`).join(', ');
    return {text, groups: list, missing};
  }
  const activitySubject = (activity, ctx = {}) => activitySubjectDetails(activity, ctx).text;

  // ---- Υπεύθυνος τμήματος μέσα σε πρόγραμμα ----
  //   classId: το id του τμήματος· ctx: {classes, staff}.
  // → {id} για εκπαιδευτικό του Προσωπικού, {name} για όνομα χωρίς αντιστοίχιση, ή null.
  //   1. ο υπεύθυνος του τμήματος (homeroomStaffId), αν εμφανίζεται στο πρόγραμμα,
  //   2. αλλιώς, μόνο για τμήμα Γενικής Παιδείας, ο εκπαιδευτικός του προγράμματος που το σύντομο όνομά του
  //      (ή το αρχικό όνομα, για όσους δεν αντιστοιχίστηκαν) ξεκινά με «[κλειδί]», π.χ. «[Α1] - …», χωρίς
  //      διάκριση πεζών–κεφαλαίων και τόνων («[ΣΤ1]» για το Στ1).
  function homeroomTeacher(program, classId, ctx = {}) {
    const record = classesById(ctx.classes || []).get(classId);
    if (!record) return null;
    const activities = program?.activities || [];
    const ids = new Set(activities.flatMap(activity => activity.staff || []));
    if (record.homeroomStaffId && ids.has(record.homeroomStaffId)) return {id: record.homeroomStaffId};
    if (!isGeneralClass(record)) return null;
    const prefix = compareKey('[' + classKey(record) + ']');
    const byName = (ctx.staff || []).find(person => ids.has(person.id) && compareKey(person.shortName).startsWith(prefix));
    if (byName) return {id: byName.id};
    const name = unique(activities.flatMap(activity => activity.unmatched || [])).find(item => compareKey(item).startsWith(prefix));
    return name ? {name} : null;
  }

  // ---- Συγκρούσεις ----
  const timesOverlap = (a, b) => a.day === b.day && a.start < b.end && b.start < a.end;
  // Συγκρούονται στους μαθητές; Κοινό τμήμα (id), εκτός αν και οι δύο έχουν υποσύνολα χωρίς κοινό στοιχείο.
  // → τα id των κοινών τμημάτων. Τα otherStudents δεν συγκρίνονται.
  function studentsClash(a, b) {
    const common = (a.classes || []).filter(id => (b.classes || []).includes(id));
    if (!common.length) return [];
    if (a.subsets?.length && b.subsets?.length && !a.subsets.some(item => b.subsets.includes(item))) return [];
    return common;
  }
  // Συγκρούσεις μέσα σε ένα πρόγραμμα, ή σε πολλά μαζί (programs: πίνακας).
  // → [{type:'staff'|'unmatched'|'class', who, day, start, end, a, b}], όπου a, b οι δραστηριότητες και who
  //   το id του εκπαιδευτικού (staff), το όνομα χωρίς αντιστοίχιση (unmatched) ή το id του τμήματος (class).
  function conflicts(programs) {
    const list = Array.isArray(programs) ? programs : [programs];
    const slots = [];
    for (const program of list) for (const activity of program?.activities || []) for (const time of activity.times || []) slots.push({activity, time});
    const result = [];
    for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
      const x = slots[i], y = slots[j];
      if (x.activity === y.activity || !timesOverlap(x.time, y.time)) continue;
      const base = {day: x.time.day, start: x.time.start > y.time.start ? x.time.start : y.time.start, end: x.time.end < y.time.end ? x.time.end : y.time.end, a: x.activity, b: y.activity};
      for (const id of (x.activity.staff || []).filter(id => (y.activity.staff || []).includes(id))) result.push({type: 'staff', who: id, ...base});
      for (const name of (x.activity.unmatched || []).filter(name => (y.activity.unmatched || []).includes(name))) result.push({type: 'unmatched', who: name, ...base});
      for (const id of studentsClash(x.activity, y.activity)) result.push({type: 'class', who: id, ...base});
    }
    return result;
  }

  // ---- Σύνθεση περιόδου ----
  // The zones of the Ολοήμερο: the hours of the grid of the Ολοήμερο Designer (Πρωινή Ζώνη, Γεύμα, Ολοήμερο,
  // Διευρυμένο). A time is in a zone of the Ολοήμερο when it fits whole in one of these hours; every other time is
  // 'morning' (also a time outside the Ώρες Διδασκαλίας, so that it counts as before).
  const OLOIMERO_CATEGORIES = Object.freeze(['early', 'meal', 'afternoon', 'extended']);
  const oloimeroTimes = teachingHours => timedHours(teachingHours).filter(item => OLOIMERO_CATEGORIES.includes(item.category));
  const zoneIn = (time, hours) => hours.some(hour => hour.start <= time.start && time.end <= hour.end) ? 'oloimero' : 'morning';
  // The zone of a time {day, start, end}: 'morning' or 'oloimero'.
  const hourZone = (time, teachingHours) => zoneIn(time, oloimeroTimes(teachingHours));
  // «Ίδια» δραστηριότητα: ίδιο μάθημα, εκπαιδευτικοί, μαθητές, ημέρα και ώρες. Η αίθουσα δεν συγκρίνεται (το
  // σχέδιο δεν έχει αίθουσες). Οι μαθητές συγκρίνονται με τα τμήματα και το κείμενο του studentsText, όχι με τα
  // σκέτα subsets: η εισαγωγή από FET βάζει στα subsets και τα υποσύνολα των ολόκληρων τμημάτων, το σχέδιο όχι.
  // Τα τμήματα συγκρίνονται με το id τους. (Ο κανόνας της Εισαγωγής Ολοημέρου.)
  const sameKey = (activity, classes) => JSON.stringify([
    String(activity.subject || '').trim(), [...(activity.staff || [])].sort(), [...(activity.unmatched || [])].sort(),
    [...(activity.classes || [])].sort(), studentsText(activity, {classes}),
    (activity.times || []).map(time => time.day + ' ' + time.start + '-' + time.end).sort()
  ]);
  const validTime = time => isObject(time) && Number.isInteger(time.day) && typeof time.start === 'string' && typeof time.end === 'string';

  // The composition of a period: the Ωρολόγιο (school), the σχέδιο Ολοημέρου (oloimero) and the Ατομικά Προγράμματα
  // (individual) of the period together, the one source of hours, conflicts and availability for every app.
  //   input: {periodId, programs, staff, classes, teachingHours}. programs: the programs of the year (an app that
  //   edits a program gives its working copy instead of the stored one); only those of the period count, one per
  //   kind (the first one found). Throws when the Ώρες Διδασκαλίας are missing or unreadable.
  // Rules:
  //   - Each kind fills its zone (KINDS[kind].zone): the Ωρολόγιο and the Ατομικά the Πρωινό, the σχέδιο Ολοημέρου
  //     the zones of the Ολοήμερο. The times of an activity are split one by one.
  //   - Times of the Ωρολόγιο in a zone of the Ολοήμερο count only when the period has no σχέδιο Ολοημέρου
  //     (oloimeroFrom 'fet'); otherwise they are ignored (reason 'design'): only the σχέδιο counts there.
  //   - Times of the Ατομικά in a zone of the Ολοήμερο and times of the σχέδιο in the Πρωινό are ignored (reason
  //     'zone'), with a warning.
  //   - Support (supportActivity: activities of the Ατομικά Προγράμματα by the service type of the teacher or the usual
  //     subjects): never a conflict on students, and not a lesson of the class. Conflicts on the teacher are always
  //     checked, also between sources.
  // → {periodId, programs:{school, oloimero, individual} (or null), staff, classes, teachingHours,
  //    oloimeroFrom: 'design'|'fet'|'none',
  //    entries: [{kind, program, activity, times, support}]  what counts; times: only the times that count,
  //    ignored: [{kind, program, activity, times, reason:'design'|'zone'}],
  //    hours: Map(staffId → {total, zones:{morning, oloimero}, kinds:{school, oloimero, individual}}),
  //    unmatchedHours: Map(name → hours),
  //    conflicts: [{type:'staff'|'unmatched'|'class', who, day, start, end, a, b, cross}] (a, b: entries; cross:
  //      between two sources),
  //    oloimeroDiff: {fetOnly:[{activity, time}], designOnly:[{activity, time}]} or null (only with both the
  //      Ωρολόγιο and the σχέδιο: the times of the Ωρολόγιο in the zones of the Ολοήμερο compared with the σχέδιο,
  //      time by time, with the rule of sameKey; data only, not an issue: changing the σχέδιο in the Designer is
  //      the normal work, so a σχέδιο that differs from the Ωρολόγιο is expected),
  //    issues: [{level:'warning'|'info', code, message, kind, activityId}]}
  //   codes: 'noDesign' (info), 'mixedZone' (an activity of the Ωρολόγιο in the Πρωινό and in a zone of the Ολοήμερο),
  //   'outsideZone' (times ignored with reason 'zone').
  function composePeriod(input = {}) {
    const periodId = input.periodId ?? null, classes = input.classes || [], staff = Array.isArray(input.staff) ? input.staff : [];
    const staffById = new Map(staff.filter(isObject).map(person => [person.id, person]));
    const zoneHours = oloimeroTimes(input.teachingHours);
    const programs = {};
    for (const kind of Object.keys(KINDS)) programs[kind] = null;
    for (const program of Array.isArray(input.programs) ? input.programs : []) {
      if (!isObject(program) || periodId == null || program.periodId !== periodId || !KINDS[program.kind]?.zone) continue;
      if (!programs[program.kind]) programs[program.kind] = program;
    }
    const design = programs.oloimero, school = programs.school;
    const oloimeroFrom = design ? 'design' : school ? 'fet' : 'none';
    const entries = [], ignored = [], issues = [];
    const label = activity => quoted(String(activity.subject ?? '').trim() || '—') + (studentsText(activity, {classes}) ? ' (' + studentsText(activity, {classes}) + ')' : '');
    if (school && !design) issues.push({level: 'info', code: 'noDesign', message: 'Η περίοδος δεν έχει σχέδιο Ολοημέρου: στις ζώνες Ολοημέρου μετρά το Ωρολόγιο.', kind: 'oloimero', activityId: null});
    for (const kind of Object.keys(KINDS)) {
      const program = programs[kind];
      if (!program) continue;
      const own = KINDS[kind].zone;
      for (const activity of Array.isArray(program.activities) ? program.activities : []) {
        if (!isObject(activity)) continue;
        const counted = [], byDesign = [], outside = [];
        const times = (activity.times || []).filter(validTime);
        for (const time of times) {
          const zone = zoneIn(time, zoneHours);
          if (zone === own || (kind === 'school' && !design)) counted.push(time);
          else if (kind === 'school') byDesign.push(time);
          else outside.push(time);
        }
        if (kind === 'school' && new Set(times.map(time => zoneIn(time, zoneHours))).size > 1)
          issues.push({level: 'warning', code: 'mixedZone', message: 'Η δραστηριότητα ' + label(activity) + ' του Ωρολογίου έχει ώρες και στο Πρωινό και σε ζώνη Ολοημέρου.', kind, activityId: activity.id ?? null});
        if (outside.length) issues.push({level: 'warning', code: 'outsideZone', message: (kind === 'oloimero' ? 'Η δραστηριότητα ' + label(activity) + ' του σχεδίου Ολοημέρου έχει ώρα στο Πρωινό' : 'Η δραστηριότητα ' + label(activity) + ' των Ατομικών Προγραμμάτων έχει ώρα σε ζώνη Ολοημέρου') + ', που δεν μετρά.', kind, activityId: activity.id ?? null});
        if (counted.length) entries.push({kind, program, activity, times: counted, support: supportActivity(kind, activity, {staff: staffById})});
        if (byDesign.length) ignored.push({kind, program, activity, times: byDesign, reason: 'design'});
        if (outside.length) ignored.push({kind, program, activity, times: outside, reason: 'zone'});
      }
    }
    // Hours: one hour per counted time; an activity with two teachers counts for both.
    const hours = new Map(), unmatchedHours = new Map();
    const hoursOf = id => { if (!hours.has(id)) hours.set(id, {total: 0, zones: {morning: 0, oloimero: 0}, kinds: Object.fromEntries(Object.keys(KINDS).map(kind => [kind, 0]))}); return hours.get(id); };
    for (const entry of entries) for (const time of entry.times) {
      const zone = zoneIn(time, zoneHours);
      for (const id of unique(entry.activity.staff || [])) { const item = hoursOf(id); item.total++; item.zones[zone]++; item.kinds[entry.kind]++; }
      for (const name of unique(entry.activity.unmatched || [])) unmatchedHours.set(name, (unmatchedHours.get(name) || 0) + 1);
    }
    // Conflicts, day by day.
    const byDay = new Map();
    for (const entry of entries) for (const time of entry.times) {
      if (!byDay.has(time.day)) byDay.set(time.day, []);
      byDay.get(time.day).push({entry, time});
    }
    const conflictsList = [];
    for (const slots of byDay.values()) for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
      const x = slots[i], y = slots[j];
      if (x.entry === y.entry || x.entry.activity === y.entry.activity || !timesOverlap(x.time, y.time)) continue;
      const base = {day: x.time.day, start: x.time.start > y.time.start ? x.time.start : y.time.start, end: x.time.end < y.time.end ? x.time.end : y.time.end, a: x.entry, b: y.entry, cross: x.entry.kind !== y.entry.kind};
      const one = x.entry.activity, two = y.entry.activity;
      for (const id of unique(one.staff || []).filter(id => (two.staff || []).includes(id))) conflictsList.push({type: 'staff', who: id, ...base});
      for (const name of unique(one.unmatched || []).filter(name => (two.unmatched || []).includes(name))) conflictsList.push({type: 'unmatched', who: name, ...base});
      if (!x.entry.support && !y.entry.support) for (const id of unique(studentsClash(one, two))) conflictsList.push({type: 'class', who: id, ...base});
    }
    // The σχέδιο Ολοημέρου compared with the Ωρολόγιο, in the zones of the Ολοήμερο, time by time. No issue: the
    // σχέδιο is changed in the Designer on purpose, and only the σχέδιο counts in these zones.
    const oloimeroDiff = school && design ? diffInZones(school, design, zoneHours, classes) : null;
    return {periodId, programs, staff, classes, teachingHours: input.teachingHours, oloimeroFrom, entries, ignored, hours, unmatchedHours, conflicts: conflictsList, oloimeroDiff, issues};
  }

  // The times of an Ωρολόγιο in the zones of the Ολοήμερο compared with a σχέδιο Ολοημέρου, time by time, with the
  // rule of sameKey (the rule of the composition: the same diff as composePeriod gives in oloimeroDiff).
  function diffInZones(school, design, zoneHours, classes) {
    const items = program => (Array.isArray(program?.activities) ? program.activities : []).filter(isObject).flatMap(activity =>
      (activity.times || []).filter(validTime).filter(time => zoneIn(time, zoneHours) === 'oloimero')
        .map(time => ({activity, time, key: sameKey({...activity, times: [time]}, classes)})));
    const waiting = new Map();
    for (const item of items(design)) { if (!waiting.has(item.key)) waiting.set(item.key, []); waiting.get(item.key).push(item); }
    const fetOnly = [];
    for (const item of items(school)) { const queue = waiting.get(item.key); if (queue?.length) queue.shift(); else fetOnly.push({activity: item.activity, time: item.time}); }
    const designOnly = [...waiting.values()].flat().map(item => ({activity: item.activity, time: item.time}));
    const order = (p, q) => p.time.day - q.time.day || (p.time.start < q.time.start ? -1 : p.time.start > q.time.start ? 1 : 0);
    return {fetOnly: fetOnly.sort(order), designOnly: designOnly.sort(order)};
  }
  // The same, for a program of the Ωρολόγιο and a σχέδιο Ολοημέρου (any two programs; e.g. a new import compared with
  // the designs of other periods). options: {classes, teachingHours}. → {fetOnly:[{activity, time}], designOnly:[…]}.
  // Throws when the Ώρες Διδασκαλίας are missing or unreadable.
  const oloimeroDiff = (school, design, options = {}) => diffInZones(school, design, oloimeroTimes(options.teachingHours), options.classes || []);

  // What a teacher has in the composition at a time: the entries whose counted times overlap it.
  //   who: {staffId} (a person of Προσωπικό) or {name} (a name without a match); at: {day, start, end};
  //   options.kinds: only these kinds (e.g. ['school', 'oloimero']); options.except: an activity to leave out.
  // → [{entry, times}], times: the counted times of the entry that overlap.
  function compositionAt(composition, who = {}, at = {}, options = {}) {
    if (!composition || !at) return [];
    const kinds = options.kinds ? new Set(options.kinds) : null, result = [];
    for (const entry of composition.entries) {
      if (kinds && !kinds.has(entry.kind)) continue;
      if (options.except && entry.activity === options.except) continue;
      const activity = entry.activity;
      if (who.staffId != null ? !(activity.staff || []).includes(who.staffId) : who.name != null ? !(activity.unmatched || []).includes(who.name) : true) continue;
      const times = entry.times.filter(time => timesOverlap(time, at));
      if (times.length) result.push({entry, times});
    }
    return result;
  }

  // ---- Μετακίνηση δραστηριοτήτων ----
  // Moving activities of a period to other times, with the rules of their kinds, in one place for every app that
  // moves them: the Πλήρες Σχολικό Πρόγραμμα (the Ωρολόγιο and the Ατομικά Προγράμματα) and the Ατομικά Προγράμματα
  // themselves. Nothing changes here.
  //   composition: the composition of the period (composePeriod) before the moves; moves: [{kind, activity, times}],
  //   the new times of each activity (a swap is two moves).
  //   Rules of the kinds (errors: no mode allows them):
  //     'zone': a time outside the zone of the kind (KINDS[kind].zone), e.g. an hour of the Ωρολόγιο or of the Ατομικά
  //             in a zone of the Ολοήμερο, which belong to the Ολοήμερο Designer;
  //     'busy': a time where the teacher has another hour and one of the two is of a kind whose hour is the
  //             teacher's alone (KINDS[kind].exclusive: the Ατομικά Προγράμματα).
  //   conflicts: what the moves clash with, among the entries that count in the composition (without the moved
  //   activities) and among the moves themselves: on the teacher always, on the students only when neither is support
  //   (supportActivity, with the staff of the composition: the rules of composePeriod). A 'busy' error is not repeated as a conflict on the teacher.
  // → {errors:[{code:'zone'|'busy', move, time, entry, other}], conflicts:[{type:'staff'|'unmatched'|'class', who,
  //    day, start, end, move, entry, other}]} (entry: the entry of the composition; other: the other move, when the
  //    clash is between two moves).
  function moveProblems(composition, moves) {
    const result = {errors: [], conflicts: []};
    if (!composition || !Array.isArray(moves) || !moves.length) return result;
    const zoneHours = oloimeroTimes(composition.teachingHours);
    const list = moves.filter(move => isObject(move) && isObject(move.activity));
    const moved = new Set(list.map(move => move.activity));
    const others = (composition.entries || []).filter(entry => !moved.has(entry.activity));
    const common = (a, b) => unique(a || []).filter(item => (b || []).includes(item));
    const staffById = new Map((composition.staff || []).filter(isObject).map(person => [person.id, person]));
    const isSupport = (kind, activity, entry) => entry ? !!entry.support : supportActivity(kind, activity, {staff: staffById});
    // One time of a move against one time of something else (an entry of the composition, or another move).
    const check = (move, time, otherActivity, otherKind, otherTime, where) => {
      if (!timesOverlap(time, otherTime)) return;
      const base = {day: time.day, start: time.start > otherTime.start ? time.start : otherTime.start, end: time.end < otherTime.end ? time.end : otherTime.end, move, entry: where.entry || null, other: where.other || null};
      const staff = common(move.activity.staff, otherActivity.staff), unmatched = common(move.activity.unmatched, otherActivity.unmatched);
      const exclusive = !!KINDS[move.kind]?.exclusive || !!KINDS[otherKind]?.exclusive;
      if ((staff.length || unmatched.length) && exclusive) result.errors.push({code: 'busy', move, time, entry: base.entry, other: base.other});
      else {
        for (const id of staff) result.conflicts.push({type: 'staff', who: id, ...base});
        for (const name of unmatched) result.conflicts.push({type: 'unmatched', who: name, ...base});
      }
      if (!isSupport(move.kind, move.activity) && !isSupport(otherKind, otherActivity, where.entry)) for (const id of unique(studentsClash(move.activity, otherActivity))) result.conflicts.push({type: 'class', who: id, ...base});
    };
    list.forEach((move, index) => {
      const times = (Array.isArray(move.times) ? move.times : []).filter(validTime);
      const zone = KINDS[move.kind]?.zone;
      for (const time of times) {
        if (zone && zoneIn(time, zoneHours) !== zone) result.errors.push({code: 'zone', move, time, entry: null, other: null});
        for (const entry of others) for (const otherTime of entry.times) check(move, time, entry.activity, entry.kind, otherTime, {entry});
        for (const other of list.slice(index + 1)) for (const otherTime of (other.times || []).filter(validTime)) check(move, time, other.activity, other.kind, otherTime, {other});
      }
    });
    return result;
  }

  // ---- Διαθεσιμότητα ----
  // Οι ώρες μη διαθεσιμότητας ενός εκπαιδευτικού από το source ενός προγράμματος FET: [{day, start, end}].
  function unavailableTimes(program, staffId) {
    const source = program?.source;
    if (source?.type !== 'fet') return [];
    const names = new Set((source.teachers || []).filter(teacher => teacher.staffId === staffId).map(teacher => teacher.name));
    return (source.unavailable || []).filter(item => names.has(item.teacher)).map(({day, start, end}) => ({day, start, end}));
  }

  // Διαθεσιμότητα ενός εκπαιδευτικού μια ημέρα («Διαθέσιμοι Εκπαιδευτικοί»).
  //   options: {composition, person (εγγραφή του Προσωπικού), day (1–5)}: οι ώρες του εκπαιδευτικού στη σύνθεση της
  //   περιόδου (composePeriod) και οι μη διαθεσιμότητες του Ωρολογίου της.
  //   Η διευθύντρια/ο διευθυντής (role 'director'), ή χωρίς σύνθεση → null.
  // → {from, to, earlyAndAfternoon, hours:[{hour, name, start, end, category, status}]}, όπου status:
  //   'free' διαθέσιμος, 'busy' έχει δραστηριότητα, 'unavailable' μη διαθέσιμος στο FET,
  //   'outside' εκτός του εξαώρου. Τα διαλείμματα δεν περιλαμβάνονται.
  function availability({composition, person, day} = {}) {
    if (!person || person.role === 'director' || !composition) return null;
    const hours = timedHours(composition.teachingHours);
    const own = composition.entries.filter(entry => (entry.activity.staff || []).includes(person.id)).flatMap(entry => entry.times).filter(time => time.day === day);
    const blocked = unavailableTimes(composition.programs.school, person.id).filter(time => time.day === day);
    const overlapsAny = (slot, list) => list.some(time => slot.start < time.end && time.start < slot.end);
    const early = hours.filter(item => item.category === 'early'), morning = hours.filter(item => item.category === 'morning');
    const hasEarly = early.some(item => overlapsAny(item, own));
    const firstZone = hasEarly ? early[0] : morning[0] || hours.find(item => item.category !== 'break');
    let from = minutes(firstZone.start) - EARLY_ARRIVAL_MINUTES, to = from + STAY_MINUTES;
    const lastEnd = own.length ? Math.max(...own.map(time => minutes(time.end))) : 0;
    if (lastEnd > to) { to = lastEnd; from = to - STAY_MINUTES; }
    const afternoon = hours.filter(item => ['meal', 'afternoon', 'extended'].includes(item.category));
    return {
      from: clock(from), to: clock(to),
      earlyAndAfternoon: hasEarly && afternoon.some(item => overlapsAny(item, own)),
      hours: hours.filter(item => item.category !== 'break').map(item => ({
        hour: item.hour, name: item.name, start: item.start, end: item.end, category: item.category,
        status: overlapsAny(item, own) ? 'busy' : overlapsAny(item, blocked) ? 'unavailable' : (minutes(item.start) >= from && minutes(item.end) <= to ? 'free' : 'outside')
      }))
    };
  }

  // Ποιοι είναι απασχολημένοι σε μια ημερομηνία και ένα διάστημα ωρών (π.χ. την ώρα μιας συνεδρίασης),
  // σύμφωνα με τη σύνθεση (composePeriod) της περιόδου που ισχύει τότε.
  //   timetables: timetablesByYear[year] ({periods, programs})· date: 'YYYY-MM-DD'· start, end: 'HH:MM'·
  //   ctx: {staff, classes, teachingHours} του έτους.
  // → {period, composition, programs, lesson:Set(id), unavailable:Set(id), error}:
  //   lesson       έχουν στη σύνθεση δραστηριότητα που επικαλύπτει το διάστημα,
  //   unavailable  είναι μη διαθέσιμοι στο FET (Ωρολόγιο της περιόδου) σε ώρα που επικαλύπτει το διάστημα (και δεν
  //                είναι στο lesson).
  //   period είναι null όταν καμία περίοδος δεν ισχύει στην ημερομηνία· programs τα προγράμματα της σύνθεσης (κενό
  //   όταν η περίοδος δεν έχει πρόγραμμα)· composition null, με error 'teachingHours', όταν η σύνθεση δεν γίνεται
  //   (λείπουν ή είναι λάθος οι Ώρες Διδασκαλίας).
  function staffBusyAt(timetables, date, start, end, ctx = {}) {
    const period = periodAt(timetables?.periods, date);
    const lesson = new Set(), unavailable = new Set();
    if (!period) return {period, composition: null, programs: [], lesson, unavailable, error: ''};
    let composition = null;
    try { composition = composePeriod({periodId: period.id, programs: timetables.programs, staff: ctx?.staff, classes: ctx?.classes, teachingHours: ctx?.teachingHours}); } catch {}
    if (!composition) return {period, composition: null, programs: [], lesson, unavailable, error: 'teachingHours'};
    const programs = Object.values(composition.programs).filter(Boolean);
    const day = isoValid(date) ? isoWeekday(date) : 0, from = minutes(start), to = minutes(end);
    if (!day || !(from < to)) return {period, composition, programs, lesson, unavailable, error: ''};
    const overlaps = time => time?.day === day && minutes(time.start) < to && from < minutes(time.end);
    for (const entry of composition.entries) if (entry.times.some(overlaps)) for (const id of entry.activity.staff || []) lesson.add(id);
    const school = composition.programs.school;
    for (const teacher of school?.source?.type === 'fet' ? school.source.teachers || [] : []) {
      if (!teacher?.staffId || lesson.has(teacher.staffId)) continue;
      if (unavailableTimes(school, teacher.staffId).some(overlaps)) unavailable.add(teacher.staffId);
    }
    return {period, composition, programs, lesson, unavailable, error: ''};
  }

  // ---- Αντικαταστάσεις ----
  // Αντίγραφο προγράμματος με αντικαταστάσεις εκπαιδευτικών [{from:id, to:id}] (Α → Β).
  //   options.staff: το Προσωπικό, για τα ονόματα της σημείωσης. Ένα πρόγραμμα από FET που άλλαξε
  //   σημειώνεται «τροποποιήθηκε μετά την εισαγωγή» (source.modifiedAfterImport), μαζί με τις αντικαταστάσεις.
  //   Σε σχέδιο του Ολοήμερου Designer αλλάζουν και οι επιλεγμένοι εκπαιδευτικοί του source, και στα Ατομικά
  //   Προγράμματα τα ελλιπή κελιά (source.pending). Οι αντικαταστάσεις γίνονται και στην αρχική κατάσταση
  //   (program.initial), ώστε η «Επαναφορά» να μη φέρνει πίσω τον εκπαιδευτικό που αντικαταστάθηκε.
  // → {program, changed}: changed = πόσες δραστηριότητες (και ελλιπή κελιά) της τρέχουσας κατάστασης άλλαξαν.
  function replaceStaff(program, replacements, options = {}) {
    const result = clone(program), map = new Map((replacements || []).filter(item => item.from && item.to && item.from !== item.to).map(item => [item.from, item.to]));
    // The history is fixed from the source before the source changes (see ensureHistory).
    ensureHistory(result);
    const used = new Set();
    const person = id => (options.staff || []).find(item => item.id === id);
    const name = id => person(id)?.name || '';
    // The replacements in one state (activities and source): the current one, or the initial one.
    const replaceIn = (activities, source) => {
      let changed = 0;
      for (const activity of Array.isArray(activities) ? activities : []) {
        if (!isObject(activity) || !(activity.staff || []).some(id => map.has(id))) continue;
        activity.staff.forEach(id => { if (map.has(id)) used.add(id); });
        activity.staff = unique(activity.staff.map(id => map.get(id) || id));
        changed++;
      }
      // The incomplete cells of the Ατομικά Προγράμματα belong to one teacher each.
      if (result.kind === 'individual' && Array.isArray(source?.pending)) {
        for (const item of source.pending) if (map.has(item?.staffId)) { used.add(item.staffId); item.staffId = map.get(item.staffId); changed++; }
      }
      // The chosen teachers of a σχέδιο of the Ολοήμερο Designer, when something changed.
      if (changed && result.kind === 'oloimero' && Array.isArray(source?.teachers)) {
        const teachers = [];
        for (const teacher of source.teachers) {
          const to = map.get(teacher?.staffId);
          const next = to ? {...teacher, staffId: to, name: person(to)?.shortName || teacher.name} : teacher;
          if (!next.staffId || !teachers.some(item => item.staffId === next.staffId)) teachers.push(next);
        }
        source.teachers = teachers;
      }
      return changed;
    };
    const changed = replaceIn(result.activities, result.source), current = new Set(used);
    if (isObject(result.initial)) replaceIn(result.initial.activities, isObject(result.initial.source) ? result.initial.source : null);
    if (changed) {
      result.updatedAt = options.now || nowIso();
      if (result.source?.type === 'fet') {
        const note = result.source.modifiedAfterImport || {replacements: []};
        note.at = result.updatedAt;
        note.replacements = [...(note.replacements || []), ...[...current].map(id => ({from: id, fromName: name(id), to: map.get(id), toName: name(map.get(id))}))];
        result.source.modifiedAfterImport = note;
      }
    }
    return {program: result, changed};
  }

  // ---- Ιστορικό προγράμματος (program.history) ----
  // The events that created or changed a program of the kinds with history (KINDS[kind].history: the Ωρολόγιο
  // 'school', the Ολοήμερο 'oloimero', the Ατομικά Προγράμματα 'individual'), newest first, at most
  // HISTORY_LIMIT. Only for information: nothing is undone from it. An entry is {at (ISO date and time), type, …}:
  //   'import'    {importer, files:[name…], activities}            import from files
  //   'create'    {from:'school'}                                  σχέδιο Ολοημέρου made automatically from the
  //               Ωρολόγιο of an import from FET (oloimeroDesignFromSchool)
  //   'copy'      {fromPeriod, replacements:[{fromName, toName}]}  copy from another period (individual:
  //               {fromPeriod, staff:[name…]}, the teachers that were copied)
  //   'oloimero'  {design, kept, removed, added, assigned}          Εισαγωγή Ολοημέρου of the FET Timetable Editor (old
  //               entries only: no longer written)
  //   'edit'      {activities}                                      manual changes, one entry per save (individual
  //               and oloimero: {staff:[name…]}, the teachers whose cells changed; oloimero without staff: only
  //               other changes of the σχέδιο, e.g. formatting, subjects, Συνενώσεις; see oloimeroHistoryEdit)
  //   'setInitial' {}                                               «Ορισμός ως Αρχική» (setInitial)
  //   'restore'   {}                                                «Επαναφορά» στην αρχική κατάσταση (restoreInitial)
  // Names are written as they were at the time of the event. history:[] (after «Καθαρισμός Ιστορικού») stays
  // empty; a program without the key gets an initial history from what its source already has.
  const HISTORY_LIMIT = 60;
  const historyTime = entry => { const time = Date.parse(entry?.at); return Number.isNaN(time) ? 0 : time; };
  // The history of a program (a copy), newest first. Without the key: built from the source of a program from
  // FET (import and files, last Εισαγωγή Ολοημέρου, replacements and moves of modifiedAfterImport: the last two only
  // in older programs), or of a σχέδιο Ολοημέρου imported from its CSV (the import), with derived:true, since times
  // and counts there are not exact.
  function programHistory(program) {
    if (Array.isArray(program?.history)) return clone(program.history.filter(isObject));
    const source = program?.source, list = [];
    if (isObject(source) && source.type === 'oloimero-designer') {
      if (typeof source.importedAt === 'string' && source.importedAt && !Number.isNaN(Date.parse(source.importedAt)))
        list.push({at: source.importedAt, type: 'import', importer: 'csv', files: [source.csvName].filter(name => typeof name === 'string' && name), derived: true});
      return list;
    }
    if (!isObject(source) || source.type !== 'fet') return list;
    const note = isObject(source.modifiedAfterImport) ? source.modifiedAfterImport : null;
    if (source.importedAt) list.push({at: source.importedAt, type: 'import', importer: 'fet', files: [source.csvName, source.fetName].filter(Boolean), derived: true});
    const replacements = (Array.isArray(note?.replacements) ? note.replacements : []).filter(isObject);
    if (replacements.length) list.push({at: note.at || source.importedAt || '', type: 'copy', fromPeriod: '', replacements: replacements.map(item => ({fromName: item.fromName || '', toName: item.toName || ''})), derived: true});
    if (isObject(source.oloimero) && source.oloimero.at) list.push({at: source.oloimero.at, type: 'oloimero', design: source.oloimero.name || '', derived: true});
    if (note?.moved) list.push({at: note.at || '', type: 'edit', derived: true});
    return list.filter(entry => entry.at).sort((a, b) => historyTime(b) - historyTime(a)).slice(0, HISTORY_LIMIT);
  }
  // Fixes the history of a program of the Ωρολόγιο in program.history (in place), so that a later change of its
  // source does not appear twice in the initial history. Called before the source changes. Returns the program.
  function ensureHistory(program) {
    if (isObject(program) && program.kind === 'school' && !Array.isArray(program.history)) program.history = programHistory(program);
    return program;
  }
  // A new entry at the start of the history of the program (in place); the HISTORY_LIMIT newest stay.
  // Returns the program.
  function addHistory(program, entry) {
    if (!isObject(program) || !isObject(entry) || typeof entry.type !== 'string' || !entry.type) throw Error('Μη έγκυρη εγγραφή Ιστορικού.');
    const {at, ...rest} = clone(entry);
    program.history = [{at: at || nowIso(), ...rest}, ...programHistory(program)].slice(0, HISTORY_LIMIT);
    return program;
  }

  // ---- Αρχική και τρέχουσα κατάσταση προγράμματος (program.initial) ----
  // Η τρέχουσα κατάσταση ενός προγράμματος είναι πάντα στα activities και στο source του, όπως τα διαβάζουν όλες οι
  // εφαρμογές. Η αρχική κρατιέται στο program.initial = {activities, source:{…}} μόνο όσο η τρέχουσα διαφέρει από αυτή,
  // ώστε το μέγεθος να μεγαλώνει μόνο στα προγράμματα που άλλαξαν. Το program.initialSetAt (ISO) λέει πότε ορίστηκε η
  // αρχική με τον «Ορισμό ως Αρχική»· χωρίς αυτό, αρχική είναι η εισαγωγή ή η δημιουργία του προγράμματος (στο
  // Ωρολόγιο: το καθαρό FET).
  // Την αρχική την κρατά το host σε κάθε αποθήκευση (keepInitial): οι εφαρμογές δεν τη φτιάχνουν και δεν την αλλάζουν,
  // και χρησιμοποιούν μόνο τα restoreInitial («Επαναφορά») και setInitial («Ορισμός ως Αρχική»).
  // Τι ανήκει στην κατάσταση (KINDS[kind].initialSource, μαζί με τις δραστηριότητες):
  //   school      οι δραστηριότητες και οι μη διαθεσιμότητες εκπαιδευτικών (unavailable)· τα υπόλοιπα στοιχεία του
  //               FET (μαθήματα, Activity Id, Teachers, ιεραρχία) δεν αλλάζουν και μένουν μόνο στο source.
  //   oloimero    οι δραστηριότητες, οι τοποθετήσεις (placements), τα ελλιπή κελιά (pending) και οι θέσεις ανά ώρα
  //               (design). Η αρχική κρατά και τους ορισμούς των εκπαιδευτικών, μαθημάτων και Συνενώσεων που
  //               χρησιμοποιεί, ώστε η επαναφορά να τους ξαναβάζει όταν λείπουν. Χρώματα, ορατότητα και οι ορισμοί
  //               που υπάρχουν ήδη δεν μετρούν και δεν επαναφέρονται.
  //   individual  οι δραστηριότητες, οι τοποθετήσεις και τα ελλιπή κελιά.
  // Στη σύγκριση δεν μετρούν τα id των δραστηριοτήτων, ούτε όσα υπολογίζονται από άλλα δεδομένα (τα τμήματα των
  // κελιών στο Ολοήμερο, το μάθημα και τα τμήματα από τον κατάλογο στα Ατομικά), ώστε μια αλλαγή στα «Τμήματα» ή στον
  // κατάλογο να μη δείχνει το πρόγραμμα τροποποιημένο.
  const stableJson = value => JSON.stringify(value, (key, item) => isObject(item) ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item);
  const timesKey = times => (Array.isArray(times) ? times : []).filter(isObject).map(time => time.day + ' ' + time.start + '-' + time.end).sort();
  const textsKey = list => (Array.isArray(list) ? list : []).map(String).sort();
  const STATE_ACTIVITY = Object.freeze({
    school: activity => [String(activity.subject ?? ''), textsKey(activity.staff), textsKey(activity.unmatched), textsKey(activity.classes), textsKey(activity.subsets), textsKey(activity.otherStudents), String(activity.room ?? ''), timesKey(activity.times)],
    oloimero: activity => [String(activity.subject ?? ''), textsKey(activity.staff), textsKey(activity.unmatched), timesKey(activity.times)],
    individual: activity => [textsKey(activity.staff), textsKey(activity.unmatched), timesKey(activity.times)]
  });
  const stateKind = kind => Object.prototype.hasOwnProperty.call(STATE_ACTIVITY, kind) ? kind : 'school';
  const initialKeys = kind => KINDS[kind]?.initialSource || KINDS.school.initialSource;
  // Η κατάσταση ενός προγράμματος ως κείμενο, για σύγκριση (ίδιο κείμενο = ίδια κατάσταση).
  function programState(program) {
    const kind = stateKind(program?.kind), source = isObject(program?.source) ? program.source : {};
    const placements = isObject(source.placements) ? source.placements : {};
    const activities = (Array.isArray(program?.activities) ? program.activities : []).filter(isObject)
      .map(activity => stableJson([STATE_ACTIVITY[kind](activity), placements[activity.id] ?? null])).sort();
    const rest = {};
    for (const key of initialKeys(program?.kind)) {
      if (key === 'placements') continue;
      const value = source[key];
      rest[key] = Array.isArray(value) ? value.map(stableJson).sort() : value ?? null;
    }
    return stableJson({activities, rest});
  }
  // Οι ορισμοί του Ολοήμερου Designer που χρησιμοποιεί ένα σχέδιο: εκπαιδευτικοί (με staffId ή όνομα), μαθήματα (με
  // όνομα ή id) και Συνενώσεις (με id) των δραστηριοτήτων, των τοποθετήσεων και των ελλιπών κελιών.
  function oloimeroDefinitions(program) {
    const source = isObject(program?.source) ? program.source : {}, activities = (Array.isArray(program?.activities) ? program.activities : []).filter(isObject);
    const pending = (Array.isArray(source.pending) ? source.pending : []).filter(isObject);
    const staffIds = new Set([...activities.flatMap(activity => activity.staff || []), ...pending.map(item => item.staffId).filter(Boolean)]);
    const names = new Set([...activities.flatMap(activity => activity.unmatched || []), ...pending.filter(item => !item.staffId).map(item => item.name).filter(Boolean)]);
    const subjectNames = new Set(activities.map(activity => String(activity.subject ?? '').trim()).filter(Boolean));
    const subjectIds = new Set(pending.map(item => item.subjectId).filter(Boolean));
    const unionIds = new Set();
    const cells = list => { for (const item of Array.isArray(list) ? list : []) if (item?.type === 'union' && item.id) unionIds.add(item.id); };
    for (const place of Object.values(isObject(source.placements) ? source.placements : {})) cells(place?.students);
    for (const item of pending) cells(item.students);
    const list = key => (Array.isArray(source[key]) ? source[key] : []).filter(isObject);
    return {
      teachers: clone(list('teachers').filter(item => item.staffId ? staffIds.has(item.staffId) : names.has(item.name))),
      subjects: clone(list('subjects').filter(item => subjectIds.has(item.id) || subjectNames.has(String(item.name ?? '').trim()))),
      unions: clone(list('unions').filter(item => unionIds.has(item.id)))
    };
  }
  // Η κατάσταση ενός προγράμματος ως αρχική: {activities, source:{…}}. Ένα κλειδί της κατάστασης που λείπει από το
  // source γράφεται null.
  function initialSnapshot(program) {
    const source = isObject(program?.source) ? program.source : {}, saved = {};
    for (const key of initialKeys(program?.kind)) saved[key] = source[key] === undefined ? null : clone(source[key]);
    if (program?.kind === 'oloimero') Object.assign(saved, oloimeroDefinitions(program));
    return {activities: clone(Array.isArray(program?.activities) ? program.activities : []), source: saved};
  }
  // Η αρχική κατάσταση ως πρόγραμμα (αντίγραφο, χωρίς initial και Ιστορικό), για εμφάνιση, σύγκριση και αναφορές, ή
  // null όταν το πρόγραμμα δεν έχει αλλάξει. Τα κλειδιά της κατάστασης έρχονται από την αρχική, τα υπόλοιπα από το
  // τρέχον source (στο Ολοήμερο οι ορισμοί είναι όσοι χρησιμοποιεί η αρχική).
  function initialProgram(program) {
    if (!isObject(program?.initial)) return null;
    const {initial, history, ...rest} = program;
    const saved = isObject(initial.source) ? initial.source : {}, source = {...(isObject(rest.source) ? clone(rest.source) : {})};
    for (const [key, value] of Object.entries(saved)) { if (value === null) delete source[key]; else source[key] = clone(value); }
    return {...clone(rest), activities: clone(Array.isArray(initial.activities) ? initial.activities : []), source};
  }
  // Το πρόγραμμα έχει αλλάξει από την αρχική του κατάσταση;
  const isModified = program => isObject(program?.initial);
  // Η αρχική κατάσταση σε μια αποθήκευση. Το καλεί το host για κάθε πρόγραμμα που γράφεται· after (αυτό που στέλνει η
  // εφαρμογή) αλλάζει επιτόπου και επιστρέφεται, before είναι το αποθηκευμένο (null για νέο πρόγραμμα).
  //   options.setInitial: «Ορισμός ως Αρχική»· το initial φεύγει και γράφεται initialSetAt (options.now).
  //   Νέο πρόγραμμα: κρατά ό,τι στέλνει η εφαρμογή (π.χ. το αντίγραφο μιας περιόδου έχει το initial της πηγής).
  //   Υπάρχον: το initial και το initialSetAt είναι πάντα του αποθηκευμένου, όποια κι αν στείλει η εφαρμογή· όταν
  //   δεν έχει initial και η κατάσταση άλλαξε, αρχική γίνεται η προηγούμενη κατάσταση.
  //   Όταν η κατάσταση είναι ίδια με την αρχική, το initial φεύγει (έτσι ολοκληρώνεται η «Επαναφορά»).
  function keepInitial(before, after, options = {}) {
    if (!isObject(after)) return after;
    if (options.setInitial) {
      delete after.initial;
      after.initialSetAt = options.now || nowIso();
      return after;
    }
    if (isObject(before)) {
      delete after.initial;
      delete after.initialSetAt;
      if (before.initialSetAt != null) after.initialSetAt = before.initialSetAt;
      if (isObject(before.initial)) after.initial = clone(before.initial);
      else if (programState(before) !== programState(after)) after.initial = initialSnapshot(before);
    }
    if (isObject(after.initial) && programState(initialProgram(after)) === programState(after)) delete after.initial;
    return after;
  }
  // «Επαναφορά»: αντίγραφο του προγράμματος με την αρχική κατάσταση ως τρέχουσα, χωρίς initial. Στο Ολοήμερο
  // ξαναμπαίνουν μόνο οι εκπαιδευτικοί, τα μαθήματα και οι Συνενώσεις της αρχικής που λείπουν· στα Ατομικά το μάθημα και
  // τα τμήματα των δραστηριοτήτων υπολογίζονται ξανά με τον κατάλογο του έτους (individualRefresh). Στα είδη με
  // Ιστορικό μπαίνει η εγγραφή 'restore'. Πρόγραμμα χωρίς initial: αντίγραφο χωρίς αλλαγή.
  //   options: {catalog, classes (για τα Ατομικά), now}.
  function restoreInitial(program, options = {}) {
    if (!isObject(program?.initial)) return clone(program);
    const initial = program.initial, saved = isObject(initial.source) ? initial.source : {};
    let result = clone(program);
    delete result.initial;
    result.activities = clone(Array.isArray(initial.activities) ? initial.activities : []);
    if (!isObject(result.source)) result.source = {};
    for (const key of initialKeys(result.kind)) {
      if (saved[key] == null) delete result.source[key];
      else result.source[key] = clone(saved[key]);
    }
    if (result.kind === 'oloimero') {
      const sameName = (a, b) => String(a?.name ?? '').trim() === String(b?.name ?? '').trim();
      const same = {
        teachers: (a, b) => a.staffId ? a.staffId === b.staffId : !b.staffId && sameName(a, b),
        subjects: (a, b) => a.id === b.id || sameName(a, b),
        unions: (a, b) => a.id === b.id
      };
      for (const key of Object.keys(same)) {
        const list = Array.isArray(result.source[key]) ? result.source[key] : [];
        for (const item of Array.isArray(saved[key]) ? saved[key] : []) {
          if (isObject(item) && !list.some(other => isObject(other) && same[key](item, other))) list.push(clone(item));
        }
        if (list.length || Array.isArray(result.source[key])) result.source[key] = list;
      }
    }
    if (result.kind === 'individual' && options.catalog) result = individualRefresh(result, {catalog: options.catalog, classes: options.classes}).program;
    result.updatedAt = options.now || nowIso();
    if (KINDS[result.kind]?.history) addHistory(result, {at: result.updatedAt, type: 'restore'});
    return result;
  }
  // «Ορισμός ως Αρχική»: αντίγραφο του προγράμματος όπου η τρέχουσα κατάσταση γίνεται η αρχική (χωρίς initial, με
  // initialSetAt), με την εγγραφή 'setInitial' στα είδη με Ιστορικό. Η εφαρμογή το στέλνει με setInitial:true στο put,
  // ώστε το host να μην ξαναβάλει το αποθηκευμένο initial. Στο Ωρολόγιο, μετά από αυτό δεν υπάρχει πια επαναφορά στο
  // καθαρό FET. options: {now}.
  function setInitial(program, options = {}) {
    const result = clone(program);
    delete result.initial;
    result.initialSetAt = options.now || nowIso();
    if (KINDS[result.kind]?.history) addHistory(result, {at: result.initialSetAt, type: 'setInitial'});
    return result;
  }

  // ---- Διαθέσιμες ώρες Ολοημέρου της περιόδου (period.oloimeroHours) ----
  // Ανά εκπαιδευτικό, ώστε να τις βλέπουν όλα τα σχέδια της περιόδου: period.oloimeroHours = {[staffId]: ώρες}, μόνο
  // όσες έγραψε ο χρήστης (ακέραιος 0–OLOIMERO_HOURS_MAX). Χωρίς τιμή ισχύει η αυτόματη πρόταση: «Ωράριο στο σχολείο»
  // μείον οι πρωινές ώρες του εκπαιδευτικού στη σύνθεση της περιόδου (όχι κάτω από 0)· χωρίς «Ωράριο στο σχολείο»,
  // καμία πρόταση (hours null).
  //   input: {period, staff, composition} (composition: η σύνθεση της περιόδου, ή null: χωρίς πρωινές ώρες).
  //   → Map(staffId → {hours, auto, schoolHours, morning}), για κάθε εκπαιδευτικό του staff.
  const OLOIMERO_HOURS_MAX = 99;
  function oloimeroAvailableHours(input = {}) {
    const saved = isObject(input.period?.oloimeroHours) ? input.period.oloimeroHours : {}, result = new Map();
    for (const person of Array.isArray(input.staff) ? input.staff : []) {
      if (!isObject(person) || !person.id) continue;
      const morning = input.composition?.hours?.get?.(person.id)?.zones?.morning || 0;
      const value = person.schoolHours === '' || person.schoolHours == null ? NaN : Number(person.schoolHours);
      const schoolHours = Number.isFinite(value) ? value : null;
      const own = saved[person.id];
      if (Number.isInteger(own) && own >= 0 && own <= OLOIMERO_HOURS_MAX) result.set(person.id, {hours: own, auto: false, schoolHours, morning});
      else result.set(person.id, {hours: schoolHours == null ? null : Math.max(0, schoolHours - morning), auto: true, schoolHours, morning});
    }
    return result;
  }

  // ---- Ατομικά Προγράμματα (kind 'individual', source type 'individual', version 1) ----
  // One program per period, with the activities of every teacher that has an individual program.
  // Every activity is one hour of one teacher (staff:[id], one entry in times). The source keeps what the cells
  // show: placements[activity id] = {subjectId|null, chips:[{type:'grade', grade} | {type:'class', id} |
  // {type:'union', id}]} and pending (incomplete cells, not activities: {staffId, day, start, end, chips}). The
  // subjects (with colour) and the Συνενώσεις are in the catalog of the year, shared by all periods
  // (timetablesByYear[year].individualCatalog = {subjects:[{id, name, color, hidden}], unions:[{id, name, grades,
  // classIds}], hidden:{grades, classes}}).
  // «Μάθημα της τάξης» (a cell with chips and no subject, subjectFromClasses:true) is offered only to the service
  // types below: Ειδική Αγωγή – Παράλληλη Στήριξη, ΕΒΠ. The teacher of the Τμήμα Ένταξης does not teach the subject
  // of the student's class, so the subject is always declared (a cell with chips only is an incomplete cell).
  const INDIVIDUAL_CLASS_SUBJECT_SERVICES = Object.freeze(['parallel', 'ebp']);
  const individualClassSubject = person => INDIVIDUAL_CLASS_SUBJECT_SERVICES.includes(person?.serviceType);
  // Support activities of the Ατομικά Προγράμματα: never a conflict on students and not a lesson of the class.
  //   - Every activity of a teacher whose service type is below (Παράλληλη Στήριξη, Τμήμα Ένταξης, ΖΕΠ – Τμήμα
  //     Υποδοχής, ΕΒΠ, ΕΕΠ) is support, whatever its subject or classes (also a «μάθημα της τάξης»).
  //   - For every other teacher only the usual subjects (INDIVIDUAL_COMMON_SUBJECTS, by name without tones and case)
  //     are support; everything else is a lesson of the class (it clashes on students like the Ωρολόγιο).
  // Worked out when read, so a change of the service type in Προσωπικό applies at once, without migration.
  const INDIVIDUAL_SUPPORT_SERVICES = Object.freeze(['parallel', 'inclusion', 'zep', 'ebp', 'psychologist', 'socialWorker', 'nurse']);
  // The usual subjects of the individual programs, offered in «Προσθήκη μαθημάτων…» of the Ατομικά Προγράμματα.
  const INDIVIDUAL_COMMON_SUBJECTS = Object.freeze(['Ενισχυτική Διδασκαλία', 'Γραμματειακή Υποστήριξη', 'Διοικητικό Έργο']);
  const subjectKey = value => window.SchoolText.withoutTones(String(value ?? '')).toLocaleLowerCase('el').replace(/\s+/g, ' ').trim();
  const COMMON_SUBJECT_KEYS = new Set(INDIVIDUAL_COMMON_SUBJECTS.map(subjectKey));
  const isCommonSubject = name => COMMON_SUBJECT_KEYS.has(subjectKey(name));
  // Whether an activity of a kind is support. options: {staff} (the Προσωπικό of the year: an array or a Map by id).
  // Kinds without KINDS[kind].support: never. A teacher not found in staff (or unmatched) counts by subject only.
  function supportActivity(kind, activity, options = {}) {
    if (!KINDS[kind]?.support || !isObject(activity)) return false;
    const list = options.staff, find = id => list instanceof Map ? list.get(id) : Array.isArray(list) ? list.find(person => person?.id === id) : null;
    if ((activity.staff || []).some(id => INDIVIDUAL_SUPPORT_SERVICES.includes(find(id)?.serviceType))) return true;
    return !activity.subjectFromClasses && isCommonSubject(activity.subject);
  }
  // An empty individual program for a period. options: {id, now}.
  function individualProgram(periodId, options = {}) {
    const now = options.now || nowIso();
    return {id: options.id || uid(), formatVersion: 2, kind: 'individual', periodId: periodId ?? null, name: '', createdAt: now, updatedAt: now,
      activities: [], source: {type: 'individual', version: 1, placements: {}, pending: []}, history: []};
  }
  // The source of an individual program in its full shape (in place). Returns the source.
  function individualSource(program) {
    if (!isObject(program.source)) program.source = {type: 'individual', version: 1};
    const source = program.source;
    if (!isObject(source.placements)) source.placements = {};
    if (!Array.isArray(source.pending)) source.pending = [];
    if (!Array.isArray(program.activities)) program.activities = [];
    return source;
  }
  // The subject, the τμήματα and the «μάθημα της τάξης» of the activities, computed again from source.placements
  // and the catalog (on every save, and in every period after a subject is renamed). A placement with a subjectId
  // gets the name of the subject in the catalog (a subject missing from the catalog keeps the stored name); a
  // placement without one is «μάθημα της τάξης» (subject '', subjectFromClasses:true). The chips become classes,
  // subsets and otherStudents with the rule of oloimeroStudents (every τμήμα, also those that are not Γενικής
  // Παιδείας). Placements of activities that no longer exist are dropped; activities without a placement stay as
  // they are. ctx: {catalog, classes}. → {program (a copy), changed: activities that changed}.
  function individualRefresh(program, ctx = {}) {
    const result = clone(program), source = individualSource(result), placements = source.placements;
    const subjects = new Map((Array.isArray(ctx.catalog?.subjects) ? ctx.catalog.subjects : []).filter(isObject).map(item => [item.id, item]));
    const lists = {unions: (Array.isArray(ctx.catalog?.unions) ? ctx.catalog.unions : []).filter(isObject)};
    const shape = activity => JSON.stringify([String(activity.subject ?? ''), !!activity.subjectFromClasses, activity.classes || [], activity.subsets || [], activity.otherStudents || []]);
    const ids = new Set();
    let changed = 0;
    for (const activity of result.activities) {
      if (!isObject(activity)) continue;
      ids.add(activity.id);
      const place = placements[activity.id];
      if (!isObject(place)) continue;
      const before = shape(activity);
      if (place.subjectId == null || place.subjectId === '') {
        activity.subject = '';
        activity.subjectFromClasses = true;
      } else {
        const subject = subjects.get(place.subjectId);
        activity.subject = subject ? String(subject.name ?? '').trim() : String(activity.subject ?? '');
        delete activity.subjectFromClasses;
      }
      const students = oloimeroStudents(Array.isArray(place.chips) ? place.chips : [], lists, ctx.classes || []);
      activity.classes = students.classes;
      activity.subsets = students.subsets;
      activity.otherStudents = students.otherStudents;
      if (shape(activity) !== before) changed++;
    }
    for (const key of Object.keys(placements)) if (!ids.has(key)) delete placements[key];
    return {program: result, changed};
  }
  // «Αντιγραφή από άλλη περίοδο…» of the Ατομικά Προγράμματα, for the chosen teachers: their activities (with new
  // ids and their placements) and incomplete cells in source replace what they have in target. target null: a new
  // program for options.periodId. Adds the history entry 'copy' {fromPeriod, staff:[names]}, with the names of the
  // teachers as they are now (full name, or short name), in the order of the Προσωπικό.
  //   options: {periodId, fromPeriod (name of the source period), staff, now}.
  //   → {program, activities, pending} (how many activities and incomplete cells were copied).
  function individualCopy(target, source, staffIds, options = {}) {
    const now = options.now || nowIso(), chosen = new Set((staffIds || []).filter(Boolean));
    const result = target ? clone(target) : individualProgram(options.periodId ?? null, {now});
    const into = individualSource(result), placements = into.placements;
    result.activities = result.activities.filter(activity => {
      const own = (activity?.staff || []).some(id => chosen.has(id));
      if (own) delete placements[activity.id];
      return !own;
    });
    into.pending = into.pending.filter(item => !chosen.has(item?.staffId));
    const from = isObject(source?.source) ? source.source : {};
    let activities = 0, pending = 0;
    for (const activity of Array.isArray(source?.activities) ? source.activities : []) {
      if (!isObject(activity) || !(activity.staff || []).some(id => chosen.has(id))) continue;
      const copy = clone(activity);
      copy.id = uid();
      result.activities.push(copy);
      if (isObject(from.placements?.[activity.id])) placements[copy.id] = clone(from.placements[activity.id]);
      activities++;
    }
    for (const item of Array.isArray(from.pending) ? from.pending : []) if (chosen.has(item?.staffId)) { into.pending.push(clone(item)); pending++; }
    result.updatedAt = now;
    const names = sortStaff((options.staff || []).filter(person => chosen.has(person?.id))).map(person => String(person.name || person.shortName || ''));
    addHistory(result, {at: now, type: 'copy', fromPeriod: String(options.fromPeriod || ''), staff: names});
    return {program: result, activities, pending};
  }

  // ---- Προβλήματα της σύνθεσης (γραμμή προειδοποιήσεων των Σχολικών Προγραμμάτων) ----
  // The conflicts and the issues of a composition (composePeriod) as a list for the user, each one with the program
  // application that shows it (target.app: a kind, whose owner opens) and, where it helps, the teacher or the τμήμα.
  //   ctx: {staff, classes}.
  //   → [{group:'staff'|'class'|'warning'|'info', level:'error'|'warning'|'info', code, who, message, day, start, end,
  //       target:{app, staffId, classId} | null, place:{staffId} | {name} | {classId} | null}]
  //   place: where a conflict is in the composition, whatever application opens it: the teacher (staffId), the name
  //   of a teacher without a match (name) or the τμήμα (classId); null for the issues. The Πλήρες Σχολικό Πρόγραμμα
  //   shows a conflict there.
  //   group 'staff' / 'class': the conflicts on a teacher (also a name without a match) or on a τμήμα; 'warning' / 'info':
  //   the issues of the composition. Sorted by group, then by the teacher or τμήμα (order of Προσωπικό / Τμήματα), day and
  //   time. Targets: a conflict that involves the Ατομικά Προγράμματα → the Ατομικά (with the teacher); a conflict inside
  //   the σχέδιο Ολοημέρου → the Ολοήμερο Designer; every other conflict → the Ωρολόγιο (the Πλήρες), with the teacher or
  //   the τμήμα (a name without a match: only the period). Issues: the difference of the σχέδιο and the Ωρολόγιο and the
  //   times of the σχέδιο in the Πρωινό → the Designer; times of the Ατομικά in a zone of the Ολοήμερο → the Ατομικά
  //   (with the teacher); an activity of the Ωρολόγιο in the Πρωινό and in a zone of the Ολοήμερο → the Ωρολόγιο (with
  //   its first τμήμα, or its teacher); the information that there is no σχέδιο → no target.
  function compositionProblems(composition, ctx = {}) {
    if (!composition) return [];
    const classes = ctx.classes || composition.classes || [], staff = Array.isArray(ctx.staff) ? ctx.staff : [];
    const people = new Map(staff.filter(isObject).map(person => [person.id, person]));
    const byId = classesById(classes);
    const staffOrder = new Map(sortStaff(staff.filter(isObject)).map((person, index) => [person.id, index]));
    const classOrder = new Map(sortClasses(classes.filter(isObject)).map((record, index) => [record.id, index]));
    const personName = id => { const person = people.get(id); return person ? String(person.shortName || person.name || person.code || '?') : '?'; };
    const className = id => byId.has(id) ? String(byId.get(id).name ?? '') || '?' : '?';
    const sourceName = kind => kind === 'school' ? 'Ωρολόγιο' : kind === 'oloimero' ? 'σχέδιο Ολοημέρου' : KINDS[kind]?.label || kind;
    const subjectOf = activity => activitySubject(activity, {composition, classes}) || (activity.subjectFromClasses ? 'μάθημα της τάξης' : '—');
    const what = entry => {
      const students = studentsText(entry.activity, {classes});
      return quoted(subjectOf(entry.activity)) + ' (' + (students ? students + ', ' : '') + sourceName(entry.kind) + ')';
    };
    const when = item => (DAY_LABELS[item.day - 1] || '?') + ' ' + item.start + '–' + item.end;
    const result = [];
    for (const conflict of composition.conflicts || []) {
      const kinds = [conflict.a.kind, conflict.b.kind];
      const onlyDesign = kinds.every(kind => kind === 'oloimero');
      let target, group, who;
      if (conflict.type === 'class') {
        group = 'class'; who = className(conflict.who);
        // A lesson of the class in the Ατομικά Προγράμματα (not support) opens the Ατομικά, with its teacher.
        const own = [conflict.a, conflict.b].find(entry => entry.kind === 'individual'), teacher = own?.activity?.staff?.[0];
        target = onlyDesign ? {app: 'oloimero'} : own ? (teacher != null ? {app: 'individual', staffId: teacher} : {app: 'individual'}) : {app: 'school', classId: conflict.who};
      } else {
        group = 'staff'; who = conflict.type === 'staff' ? personName(conflict.who) : String(conflict.who);
        if (conflict.type === 'staff' && kinds.includes('individual')) target = {app: 'individual', staffId: conflict.who};
        else if (onlyDesign) target = {app: 'oloimero'};
        else target = conflict.type === 'staff' ? {app: 'school', staffId: conflict.who} : {app: 'school'};
      }
      const place = conflict.type === 'class' ? {classId: conflict.who} : conflict.type === 'staff' ? {staffId: conflict.who} : {name: String(conflict.who)};
      result.push({group, level: 'error', code: conflict.type, who, day: conflict.day, start: conflict.start, end: conflict.end, target, place,
        order: group === 'staff' ? (conflict.type === 'staff' && staffOrder.has(conflict.who) ? staffOrder.get(conflict.who) : 1e6) : (classOrder.has(conflict.who) ? classOrder.get(conflict.who) : 1e6),
        message: who + ' — ' + when(conflict) + ': ' + what(conflict.a) + ' και ' + what(conflict.b) + '.'});
    }
    const activityOf = issue => {
      const program = composition.programs?.[issue.kind];
      return issue.activityId == null || !Array.isArray(program?.activities) ? null : program.activities.find(item => isObject(item) && item.id === issue.activityId) || null;
    };
    for (const issue of composition.issues || []) {
      const activity = activityOf(issue);
      let target = null;
      if (issue.code === 'outsideZone' && issue.kind === 'oloimero') target = {app: 'oloimero'};
      else if (issue.code === 'outsideZone' && issue.kind === 'individual') target = activity?.staff?.[0] ? {app: 'individual', staffId: activity.staff[0]} : {app: 'individual'};
      else if (issue.code === 'mixedZone') target = activity?.classes?.[0] ? {app: 'school', classId: activity.classes[0]} : activity?.staff?.[0] ? {app: 'school', staffId: activity.staff[0]} : {app: 'school'};
      const info = issue.level === 'info';
      result.push({group: info ? 'info' : 'warning', level: info ? 'info' : 'warning', code: issue.code, who: '', day: null, start: '', end: '', target, place: null, order: 0, message: issue.message});
    }
    const groups = ['staff', 'class', 'warning', 'info'];
    result.sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || a.order - b.order || classCollator.compare(a.who, b.who) ||
      (a.day ?? 0) - (b.day ?? 0) || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    return result.map(({order, ...item}) => item);
  }

  // ---- Αντίγραφο ασφαλείας περιόδου ----
  // An external file (JSON) with a period of «Σχολικά Προγράμματα»: the period (with its available hours of the
  // Ολοήμερο), its programs whole (initial state and history), and what they use from the year: the subjects and the
  // Συνενώσεις of the catalog of the Ατομικά Προγράμματα, the τμήματα and the teachers (with their ids, for the matching
  // and the messages of a restore). It is restored only in the same school year, as a new period or in place of a period.
  // It is plain JSON, not encrypted, also when the shared file has a password: it holds names of teachers, no students.
  //   {app:'SchoolProgramsBackup', formatVersion:1, createdAt, school:{name, year}, period, programs:[…],
  //    catalog:{subjects:[…], unions:[…]}, classes:[{id, name, grade, number}], staff:[{id, code, shortName, name}]}
  const BACKUP_APP = 'SchoolProgramsBackup', BACKUP_FORMAT = 1;
  // Every text (strings and keys of objects) of a value, into the set: the ids are found wherever they are, so that a
  // new place of an id in a source does not need a change here.
  function collectTexts(value, into) {
    if (typeof value === 'string') into.add(value);
    else if (Array.isArray(value)) for (const item of value) collectTexts(item, into);
    else if (isObject(value)) for (const [key, item] of Object.entries(value)) { into.add(key); collectTexts(item, into); }
    return into;
  }
  // A copy of the value with every text (strings and keys) found in map replaced (ids of τμήματα, of subjects and of
  // Συνενώσεις; they are UUIDs, so no other text matches them).
  function remapTexts(value, map) {
    if (!map.size) return clone(value);
    if (typeof value === 'string') return map.has(value) ? map.get(value) : value;
    if (Array.isArray(value)) return value.map(item => remapTexts(item, map));
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [map.has(key) ? map.get(key) : key, remapTexts(item, map)]));
    return value;
  }
  const backupFileDate = iso => { const [y, m, d] = String(iso || '').slice(0, 10).split('-'); return d && m && y ? d + '-' + m + '-' + y : ''; };
  // The backup of a period. input: {school:{name, year}, period, programs (those of the period, as stored), staff,
  // classes, catalog (individualCatalog of the year), now}. → {backup, fileName}.
  function periodBackup(input = {}) {
    const period = clone(input.period || {}), programs = clone((input.programs || []).filter(program => isObject(program) && program.periodId === period.id));
    const texts = collectTexts(programs, new Set());
    collectTexts(period.oloimeroHours || {}, texts);
    const catalog = isObject(input.catalog) ? input.catalog : {};
    const subjects = (Array.isArray(catalog.subjects) ? catalog.subjects : []).filter(item => isObject(item) && texts.has(item.id)).map(clone);
    const unions = (Array.isArray(catalog.unions) ? catalog.unions : []).filter(item => isObject(item) && texts.has(item.id)).map(clone);
    // The τμήματα of the Συνενώσεις that are kept also go with them.
    collectTexts(unions, texts);
    const classes = (input.classes || []).filter(item => isObject(item) && texts.has(item.id)).map(item => {
      const record = {id: item.id, name: String(item.name ?? '')};
      if (isGeneralClass(item)) Object.assign(record, {grade: item.grade, number: item.number});
      return record;
    });
    const staff = (input.staff || []).filter(person => isObject(person) && texts.has(person.id)).map(person => ({id: person.id, code: String(person.code ?? ''), shortName: String(person.shortName ?? ''), name: String(person.name ?? '')}));
    const now = input.now || nowIso();
    const backup = {app: BACKUP_APP, formatVersion: BACKUP_FORMAT, createdAt: now, school: {name: String(input.school?.name ?? ''), year: String(input.school?.year ?? '')},
      period, programs, catalog: {subjects, unions}, classes, staff};
    const name = String(period.name ?? '').trim() || 'περίοδος';
    const fileName = ('Προγράμματα – ' + name + ' – ' + backup.school.year + ' – ' + backupFileDate(localDay(now)) + '.json').replace(/[\\/:*?"<>|]+/g, '_');
    return {backup, fileName};
  }
  const localDay = iso => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return String(iso || '').slice(0, 10);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  };
  // Reads the text of a backup file. Throws an error with a message for the user when it is not a backup of a period.
  function readPeriodBackup(textValue) {
    const fail = message => { throw Error(message); };
    let value;
    try { value = JSON.parse(String(textValue ?? '').replace(/^﻿/, '')); }
    catch { fail('Το αρχείο δεν είναι αντίγραφο ασφαλείας των Σχολικών Προγραμμάτων (δεν διαβάζεται ως JSON).'); }
    if (!isObject(value) || value.app !== BACKUP_APP) fail('Το αρχείο δεν είναι αντίγραφο ασφαλείας περιόδου των Σχολικών Προγραμμάτων.');
    if (!Number.isInteger(value.formatVersion) || value.formatVersion < 1) fail('Το αντίγραφο ασφαλείας δεν έχει έγκυρη έκδοση μορφής.');
    if (value.formatVersion > BACKUP_FORMAT) fail('Το αντίγραφο ασφαλείας φτιάχτηκε από νεότερη έκδοση των Σχολικών Προγραμμάτων. Βεβαιώσου ότι τα αρχεία της σουίτας είναι η τελευταία έκδοση.');
    const bad = () => fail('Το αντίγραφο ασφαλείας είναι κατεστραμμένο ή ελλιπές.');
    if (!isObject(value.school) || typeof value.school.year !== 'string' || !isObject(value.period) || typeof value.period.id !== 'string' || !value.period.id) bad();
    if (!Array.isArray(value.programs) || !value.programs.every(program => isObject(program) && typeof program.kind === 'string' && program.periodId === value.period.id)) bad();
    if (!isObject(value.catalog) || !Array.isArray(value.catalog.subjects) || !Array.isArray(value.catalog.unions) || !Array.isArray(value.classes) || !Array.isArray(value.staff)) bad();
    if (![...value.catalog.subjects, ...value.catalog.unions, ...value.classes, ...value.staff].every(item => isObject(item) && typeof item.id === 'string' && item.id)) bad();
    return value;
  }
  // The analysis of a restore, before anything changes. ctx: {year, school (name), staff, classes, catalog}.
  //   errors: the restore cannot start (another school year, an unknown or a second program of a kind, a teacher or a
  //   τμήμα that is no longer in the year); warnings: another school name; info: what will be restored.
  //   A τμήμα is found by its id, otherwise by its key (Α1) or, for another τμήμα, by its name; a subject or a Συνένωση
  //   of the catalog by its id, otherwise by its name (without tones and case). What is found by the key or the name gets
  //   its id (remap); subjects and Συνενώσεις not found at all are added to the catalog (addSubjects, addUnions).
  //   → {ok, errors, warnings, info, backup, remap:Map(old id → id of the year), addSubjects, addUnions, programs:[{kind,
  //      label, activities}]}
  function analyzePeriodRestore(backup, ctx = {}) {
    const errors = [], warnings = [], info = [], remap = new Map();
    const result = {ok: false, errors, warnings, info, backup, remap, addSubjects: [], addUnions: [], programs: []};
    if (String(backup?.school?.year) !== String(ctx.year)) {
      errors.push('Το αντίγραφο είναι του σχολικού έτους ' + (backup?.school?.year || '?') + ', ενώ το ανοιχτό σχολικό έτος είναι ' + ctx.year + '. Η επαναφορά γίνεται μόνο στο ίδιο σχολικό έτος, ώστε να ταιριάζουν οι εκπαιδευτικοί, τα τμήματα και ο κατάλογος των Ατομικών Προγραμμάτων.');
      return result;
    }
    if (ctx.school != null && String(backup.school.name || '').trim() && compareKey(backup.school.name) !== compareKey(ctx.school))
      warnings.push('Το αντίγραφο είναι του σχολείου ' + quoted(backup.school.name) + ', ενώ το ανοιχτό αρχείο είναι του ' + quoted(ctx.school) + '.');
    const kinds = new Set();
    for (const program of backup.programs) {
      if (!KINDS[program.kind]) errors.push('Το αντίγραφο έχει πρόγραμμα άγνωστου είδους ' + quoted(program.kind) + '. Βεβαιώσου ότι τα αρχεία της σουίτας είναι η τελευταία έκδοση.');
      else if (kinds.has(program.kind)) errors.push('Το αντίγραφο έχει δύο προγράμματα του είδους ' + quoted(KINDS[program.kind].label) + '.');
      kinds.add(program.kind);
    }
    // Teachers: only by their id (a teacher added again gets a new one).
    const staffIds = new Set((ctx.staff || []).filter(isObject).map(person => person.id));
    const missingStaff = backup.staff.filter(person => !staffIds.has(person.id));
    if (missingStaff.length) errors.push('Στο Προσωπικό του έτους δεν υπάρχουν πια ' + (missingStaff.length === 1 ? 'ο/η εκπαιδευτικός ' : 'οι εκπαιδευτικοί ') + missingStaff.map(person => quoted(person.shortName || person.name || person.code || '?')).join(', ') + '. Τα προγράμματα του αντιγράφου αναφέρονται στους εκπαιδευτικούς με την ταυτότητά τους στο Προσωπικό, και ένας εκπαιδευτικός που προστίθεται ξανά παίρνει νέα. Η επαναφορά δεν μπορεί να γίνει σε αυτό το αρχείο.');
    // Τμήματα: by id, by key, by name.
    const yearClasses = (ctx.classes || []).filter(isObject), classIds = new Set(yearClasses.map(item => item.id));
    const missingClasses = [];
    for (const record of backup.classes) {
      if (classIds.has(record.id)) continue;
      const key = isGeneralClass(record) ? classKey(record) : '';
      const found = key ? yearClasses.find(item => classKey(item) === key)
        : yearClasses.find(item => !isGeneralClass(item) && compareKey(item.name) === compareKey(record.name));
      if (found) remap.set(record.id, found.id);
      else missingClasses.push(record);
    }
    if (missingClasses.length) errors.push('Στα «Τμήματα» του έτους δεν υπάρχουν ' + (missingClasses.length === 1 ? 'το τμήμα ' : 'τα τμήματα ') + missingClasses.map(item => quoted(item.name || classKey(item) || '?')).join(', ') + ', που χρησιμοποιούν τα προγράμματα του αντιγράφου. Η επαναφορά δεν μπορεί να ξεκινήσει. Πρόσθεσέ ' + (missingClasses.length === 1 ? 'το' : 'τα') + ' ξανά στα «Τμήματα» με το ίδιο όνομα, πάτησε «Αποθήκευση» εκεί, και ξαναδοκίμασε.');
    // The catalog of the Ατομικά Προγράμματα: by id, by name; the rest is added.
    const catalog = isObject(ctx.catalog) ? ctx.catalog : {};
    const match = (list, own, add) => {
      const current = (Array.isArray(list) ? list : []).filter(isObject), ids = new Set(current.map(item => item.id));
      for (const item of own) {
        if (ids.has(item.id)) continue;
        const found = current.find(other => compareKey(other.name) === compareKey(item.name));
        if (found) remap.set(item.id, found.id);
        else add.push(item);
      }
      return current.length;
    };
    const subjectCount = match(catalog.subjects, backup.catalog.subjects, result.addSubjects);
    const unionCount = match(catalog.unions, backup.catalog.unions, result.addUnions);
    if (subjectCount + result.addSubjects.length > 500 || unionCount + result.addUnions.length > 500) errors.push('Ο κατάλογος των Ατομικών Προγραμμάτων θα ξεπερνούσε το όριο των 500 μαθημάτων ή Συνενώσεων.');
    result.programs = Object.keys(KINDS).map(kind => backup.programs.find(program => program.kind === kind)).filter(Boolean)
      .map(program => ({kind: program.kind, label: KINDS[program.kind].label, activities: Array.isArray(program.activities) ? program.activities.length : 0}));
    if (!result.programs.length) info.push('Η περίοδος του αντιγράφου δεν έχει προγράμματα.');
    result.ok = !errors.length;
    return result;
  }
  // The restored period: its programs (new ids, in periodId, with the ids of the year and a history entry
  // 'backupRestore'), its available hours of the Ολοήμερο, and the catalog with the additions.
  //   options: {periodId, catalog (individualCatalog of the year), classes, fileName, now}.
  //   → {programs, oloimeroHours, catalog, added:{subjects, unions}}
  function buildPeriodRestore(analysis, options = {}) {
    if (!analysis?.ok) throw Error('Η επαναφορά δεν μπορεί να γίνει: ' + (analysis?.errors || []).join(' '));
    const now = options.now || nowIso(), backup = analysis.backup, remap = analysis.remap;
    const base = isObject(options.catalog) ? clone(options.catalog) : {};
    const subjects = remapTexts(analysis.addSubjects, remap), unions = remapTexts(analysis.addUnions, remap);
    const catalog = {...base, subjects: [...(Array.isArray(base.subjects) ? base.subjects : []), ...subjects], unions: [...(Array.isArray(base.unions) ? base.unions : []), ...unions],
      hidden: isObject(base.hidden) ? base.hidden : {grades: [], classes: []}};
    const programs = backup.programs.filter(program => KINDS[program.kind]).map(original => {
      let program = remapTexts(original, remap);
      Object.assign(program, {id: uid(), periodId: options.periodId ?? null, updatedAt: now});
      if (program.kind === 'individual') program = individualRefresh(program, {catalog, classes: options.classes || []}).program;
      if (KINDS[program.kind].history) addHistory(program, {at: now, type: 'backupRestore', file: String(options.fileName || ''), fromPeriod: String(backup.period?.name ?? ''), backupAt: String(backup.createdAt || '')});
      return program;
    });
    const hours = isObject(backup.period?.oloimeroHours) ? clone(backup.period.oloimeroHours) : {};
    return {programs, oloimeroHours: hours, catalog, added: {subjects, unions}};
  }

  // ---- Ετικέτες ημέρας και ώρας (Ώρες Διδασκαλίας) ----
  function tagSets(teachingHours) {
    const dayTags = new Map(DAY_KEYS.map((key, index) => [String(teachingHours?.dayTags?.[key] || '').trim(), index + 1]).filter(([tag]) => tag));
    const hourTags = new Set((teachingHours?.hours || []).map(hour => String(hour.fetTag || '').trim()).filter(Boolean));
    return {dayTags, hourTags};
  }
  const tagsOf = value => (Array.isArray(value) ? value : String(value ?? '').split('+')).map(tag => String(tag).trim()).filter(Boolean);

  // ---- Εισαγωγή από FET ----
  const CSV_COLUMNS = Object.freeze({id: 'Activity Id', day: 'Day', hour: 'Hour', students: 'Students Sets', subject: 'Subject', teachers: 'Teachers', tags: 'Activity Tags', room: 'Room'});

  // Τα στοιχεία του .fet που κρατά το source.
  function readFetFile(fetText) {
    const doc = parseFet(fetText, {require: ['Days_List', 'Hours_List', 'Teachers_List', 'Students_List', 'Activities_List'], message: 'Το αρχείο .fet δεν είναι έγκυρο αρχείο FET με ημέρες, ώρες, εκπαιδευτικούς, μαθητές και δραστηριότητες.'});
    const root = doc.documentElement;
    const trimmed = (node, tag) => text(node, tag).trim();
    const days = children(child(root, 'Days_List'), 'Day').map(node => ({name: trimmed(node, 'Name'), longName: trimmed(node, 'Long_Name')}));
    const hours = children(child(root, 'Hours_List'), 'Hour').map(node => trimmed(node, 'Name'));
    const teachers = children(child(root, 'Teachers_List'), 'Teacher').map(node => ({name: trimmed(node, 'Name'), longName: trimmed(node, 'Long_Name'), code: trimmed(node, 'Code'), target: trimmed(node, 'Target_Number_of_Hours')}));
    const subjects = children(child(root, 'Subjects_List'), 'Subject').map(node => ({name: trimmed(node, 'Name'), longName: trimmed(node, 'Long_Name'), code: trimmed(node, 'Code')}));
    const students = children(child(root, 'Students_List'), 'Year').map(year => ({
      name: trimmed(year, 'Name'),
      groups: children(year, 'Group').map(group => ({name: trimmed(group, 'Name'), subgroups: children(group, 'Subgroup').map(subgroup => trimmed(subgroup, 'Name'))}))
    }));
    const activities = new Map(children(child(root, 'Activities_List'), 'Activity').map(node => [trimmed(node, 'Id'), {
      teachers: children(node, 'Teacher').map(item => item.textContent.trim()),
      subject: trimmed(node, 'Subject'),
      students: children(node, 'Students').map(item => item.textContent.trim()),
      tags: children(node, 'Activity_Tag').map(item => item.textContent.trim())
    }]));
    const unavailable = children(child(root, 'Time_Constraints_List'), 'ConstraintTeacherNotAvailableTimes')
      .filter(node => trimmed(node, 'Active') !== 'false')
      .flatMap(node => children(node, 'Not_Available_Time').map(slot => ({teacher: trimmed(node, 'Teacher'), day: trimmed(slot, 'Day'), hour: trimmed(slot, 'Hour'), weight: trimmed(node, 'Weight_Percentage')})));
    return {days, hours, teachers, subjects, students, activities, unavailable};
  }

  // Ανάλυση της εισαγωγής ωρολογίου από FET (πρώτη φάση· δεν αλλάζει τίποτα).
  //   input: {csvText, csvName, fetText, fetName, staff, classes, classLimit, teachingHours, replacing (το
  //           πρόγραμμα που θα αντικατασταθεί, αν υπάρχει)}. classes: τα Τμήματα του έτους, μαζί με όσα δεν
  //           έχουν αποθηκευτεί ακόμη· classLimit: το όριο πλήθους τμημάτων.
  // → {ok, errors, warnings, info, unmatchedTeachers, counts, newClasses, …}. Με λάθη η εισαγωγή δεν γίνεται.
  //   Τμήματα: τα Groups του FET αντιστοιχίζονται με το SchoolClasses.resolver· όσα τμήματα Γενικής Παιδείας
  //   λείπουν δημιουργούνται (newClasses, με τελικά id, που τα αποθηκεύει η εφαρμογή μαζί με το πρόγραμμα)·
  //   ονόματα που δεν είναι τμήματα μπαίνουν στο otherStudents.
  //   unmatchedTeachers: εκπαιδευτικοί χωρίς αντιστοίχιση· ο χρήστης επιλέγει «Εισαγωγή χωρίς
  //   αντιστοίχιση» ή «Να μην εισαχθούν» (buildFetProgram, options.unmatched 'keep' ή 'drop').
  //   Ζώνες (λάθη): μια δραστηριότητα με ώρες και στο Πρωινό και σε ζώνη Ολοημέρου, και μια δραστηριότητα σε ζώνη
  //   Ολοημέρου με υποσύνολα, τμήματα που δεν είναι Γενικής Παιδείας ή ομάδες μαθητών.
  function analyzeFetImport(input = {}) {
    const result = {ok: false, errors: [], warnings: [], info: [], unmatchedTeachers: [], counts: {}, newClasses: [], csvName: input.csvName || '', fetName: input.fetName || ''};
    const stop = message => { result.errors.push(message); return result; };
    const staff = input.staff || [];
    if (!staff.length) return stop('Δεν έχει συμπληρωθεί το Προσωπικό του σχολικού έτους. Συμπλήρωσέ το πρώτα στο «Προσωπικό».');
    let hours;
    try { hours = timedHours(input.teachingHours); } catch (error) { return stop(error.message); }
    const hourByName = new Map(hours.map(item => [item.name, item]));

    // CSV ωρολογίου
    const table = parse(input.csvText);
    const header = (table[0] || []).map(value => value.trim());
    const columns = Object.fromEntries(Object.entries(CSV_COLUMNS).map(([key, name]) => [key, header.indexOf(name)]));
    const missing = Object.entries(CSV_COLUMNS).filter(([key]) => key !== 'room' && columns[key] < 0).map(([, name]) => quoted(name));
    if (!header.length || missing.length) return stop('Το αρχείο CSV δεν είναι ωρολόγιο του FET: λείπουν οι στήλες ' + (missing.join(', ') || 'του ωρολογίου') + '. Χρησιμοποίησε το «…_timetable.csv» (ή «…_activities.csv» με ημέρες και ώρες) που γράφει το FET.');
    const rows = table.slice(1).map((row, index) => ({line: index + 2, get: key => columns[key] < 0 ? '' : (row[columns[key]] || '').trim()}));
    if (!rows.length) return stop('Το CSV δεν έχει δραστηριότητες. Έλεγξε ότι το FET ολοκλήρωσε τη δημιουργία προγράμματος και ότι επέλεξες το σωστό αρχείο.');

    // .fet
    let fet;
    try { fet = readFetFile(input.fetText); } catch (error) { return stop(error.message); }

    // Έλεγχος ωρών και ημερών
    const missingFetHours = fet.hours.filter(name => !hourByName.has(name));
    const missingCsvHours = unique(rows.map(row => row.get('hour'))).filter(name => !hourByName.has(name));
    if (missingFetHours.length || missingCsvHours.length) {
      return stop('Οι ώρες του FET δεν ταιριάζουν με τις Ώρες Διδασκαλίας. ' +
        (missingFetHours.length ? 'Ώρες του .fet που λείπουν από τις Ώρες Διδασκαλίας: ' + missingFetHours.map(quoted).join(', ') + '. ' : '') +
        (missingCsvHours.length ? 'Ώρες του CSV που λείπουν από τις Ώρες Διδασκαλίας: ' + missingCsvHours.map(quoted).join(', ') + '. ' : '') +
        'Διόρθωσε τις Ώρες Διδασκαλίας ή το FET και ξαναδοκίμασε.');
    }
    const dayNumber = name => {
      let index = weekdayIndex(name);
      if (index < 0) { const day = fet.days.find(item => item.name === name); if (day) index = weekdayIndex(day.longName); }
      return index < 0 ? 0 : index + 1;
    };
    const badDays = unique([...fet.days.map(day => day.name), ...rows.map(row => row.get('day'))]).filter(name => !dayNumber(name));
    if (badDays.length) return stop((badDays.length === 1 ? 'Η ημέρα ' + quoted(badDays[0]) + ' δεν αντιστοιχεί' : 'Οι ημέρες ' + badDays.map(quoted).join(', ') + ' δεν αντιστοιχούν') + ' σε Δευτέρα–Παρασκευή. Διόρθωσε τα ονόματα των ημερών στο FET ή στο CSV.');
    const usedDays = new Map();
    for (const day of fet.days) {
      const number = dayNumber(day.name);
      if (usedDays.has(number)) return stop('Οι ημέρες ' + quoted(usedDays.get(number)) + ' και ' + quoted(day.name) + ' του FET αντιστοιχούν και οι δύο στην ' + DAY_LABELS[number - 1] + '. Διόρθωσε τα ονόματα των ημερών στο FET.');
      usedDays.set(number, day.name);
    }

    // Δραστηριότητες (μία γραμμή του CSV ανά ώρα)
    const activities = new Map();
    for (const row of rows) {
      const id = row.get('id');
      if (!id) return stop('Η γραμμή ' + row.line + ' του CSV δεν έχει «Activity Id».');
      const hour = hourByName.get(row.get('hour'));
      if (!activities.has(id)) activities.set(id, {fetId: id, subject: row.get('subject'), teachers: tagsOf(row.get('teachers')), studentsSets: row.get('students'), csvTags: tagsOf(row.get('tags')), room: row.get('room'), times: []});
      activities.get(id).times.push({day: dayNumber(row.get('day')), start: hour.start, end: hour.end});
    }
    for (const activity of activities.values()) activity.times.sort((a, b) => a.day - b.day || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

    // CSV και .fet
    const notInFet = [...activities.values()].filter(activity => !fet.activities.has(activity.fetId));
    const fetTeacherNames = new Set(fet.teachers.map(teacher => teacher.name));
    const teacherNames = unique([...activities.values()].flatMap(activity => activity.teachers));
    const teachersNotInFet = teacherNames.filter(name => !fetTeacherNames.has(name));
    if (notInFet.length) result.info.push(notInFet.length + ' δραστηριότητες του CSV δεν υπάρχουν στο .fet (Activity Id ' + notInFet.map(activity => activity.fetId).join(', ') + '). Εισάγονται κανονικά, χωρίς τα στοιχεία του .fet.');
    if (teachersNotInFet.length) result.info.push('Εκπαιδευτικοί του CSV που δεν υπάρχουν στο .fet: ' + teachersNotInFet.map(quoted).join(', ') + '. Δεν θα έχουν κωδικό ούτε μη διαθεσιμότητες.');
    const different = [...activities.values()].filter(activity => {
      const original = fet.activities.get(activity.fetId);
      return original && (original.subject !== activity.subject || original.teachers.join('+') !== activity.teachers.join('+') || original.students.join('+') !== activity.studentsSets);
    });
    if (different.length) result.warnings.push(different.length + ' δραστηριότητες έχουν διαφορετικό μάθημα, εκπαιδευτικούς ή μαθητές στο CSV και στο .fet (π.χ. Activity Id ' + different.slice(0, 5).map(activity => activity.fetId).join(', ') + '). Έλεγξε ότι το CSV βγήκε από αυτό το .fet. Στο πρόγραμμα μπαίνουν τα στοιχεία του CSV.');

    // Εκπαιδευτικοί: πρώτα με τον κωδικό, μετά με το σύντομο όνομα
    const byCode = new Map(staff.filter(person => person.code).map(person => [compareKey(person.code), person]));
    const byShortName = new Map(staff.filter(person => person.shortName).map(person => [compareKey(person.shortName), person]));
    const fetTeacher = new Map(fet.teachers.map(teacher => [teacher.name, teacher]));
    const teacherMatch = new Map();
    for (const name of teacherNames) {
      const code = fetTeacher.get(name)?.code || '';
      const codeMatch = code ? byCode.get(compareKey(code)) : null, nameMatch = byShortName.get(compareKey(name));
      if (codeMatch && nameMatch && codeMatch.id !== nameMatch.id) result.warnings.push('Ο κωδικός ' + quoted(code) + ' του ' + quoted(name) + ' ανήκει στον/στην ' + quoted(codeMatch.shortName) + ' του Προσωπικού, ενώ το σύντομο όνομα ανήκει στον/στην ' + quoted(nameMatch.shortName) + '. Κρατήθηκε η αντιστοίχιση με τον κωδικό.');
      const person = codeMatch || nameMatch || null;
      teacherMatch.set(name, person ? person.id : null);
      if (!person) result.unmatchedTeachers.push(name);
    }
    if (result.unmatchedTeachers.length) result.warnings.push('Εκπαιδευτικοί χωρίς αντιστοίχιση στο Προσωπικό: ' + result.unmatchedTeachers.map(quoted).join(', ') + '. Μπορούν να εισαχθούν χωρίς αντιστοίχιση ή να μην εισαχθούν. Για αντιστοίχιση, διόρθωσε τον κωδικό ή το σύντομο όνομα στο Προσωπικό ή στο FET.');

    // Τμήματα: μόνο όσα εμφανίζονται στις δραστηριότητες.
    const resolver = classResolver(input.classes, {limit: input.classLimit});
    const hierarchy = studentsIndex(fet.students);
    for (const activity of activities.values()) activity.students = expandStudents(activity.studentsSets, hierarchy, resolver);
    if (resolver.overLimit.length) return stop('Η εισαγωγή θα δημιουργούσε τα τμήματα ' + resolver.overLimit.join(', ') + ', πάνω από το όριο των ' + input.classLimit + ' τμημάτων του σχολικού έτους. Αφαίρεσε τμήματα που δεν χρειάζονται στα «Τμήματα» ή διόρθωσε το FET.');
    // Zones: an activity is whole in the Πρωινό or whole in the zones of the Ολοήμερο; in the zones of the Ολοήμερο
    // only τάξεις and τμήματα Γενικής Παιδείας, because only those fit in a σχέδιο Ολοημέρου.
    const zoneHours = oloimeroTimes(input.teachingHours), classById = classesById(resolver.classes);
    const activityText = activity => 'Activity Id ' + activity.fetId + ' ' + quoted(activity.subject || '—') + (activity.studentsSets ? ' (' + activity.studentsSets + ')' : '') + ', ' +
      activity.times.map(time => DAY_LABELS[time.day - 1] + ' ' + time.start + '–' + time.end).join(', ');
    const listText = list => list.slice(0, 8).map(activityText).join('· ') + (list.length > 8 ? '· και ' + (list.length - 8) + ' ακόμη' : '');
    const mixed = [], notGeneral = [];
    for (const activity of activities.values()) {
      const zones = new Set(activity.times.map(time => zoneIn(time, zoneHours)));
      if (zones.size > 1) mixed.push(activity);
      else if (zones.has('oloimero') && (activity.students.subsets.length || activity.students.otherStudents.length || activity.students.classes.some(id => !isGeneralClass(classById.get(id))))) notGeneral.push(activity);
    }
    if (mixed.length) result.errors.push((mixed.length === 1 ? 'Μία δραστηριότητα του FET έχει' : mixed.length + ' δραστηριότητες του FET έχουν') + ' ώρες και στο Πρωινό και σε ζώνη Ολοημέρου: ' + listText(mixed) + '. Κάθε δραστηριότητα πρέπει να είναι ολόκληρη στο Πρωινό ή ολόκληρη σε ζώνες Ολοημέρου. Διόρθωσε το FET και ξαναδημιούργησε το πρόγραμμα.');
    if (notGeneral.length) result.errors.push((notGeneral.length === 1 ? 'Μία δραστηριότητα του FET σε ζώνη Ολοημέρου έχει' : notGeneral.length + ' δραστηριότητες του FET σε ζώνες Ολοημέρου έχουν') + ' υποσύνολα, τμήματα που δεν είναι Γενικής Παιδείας ή ομάδες μαθητών: ' + listText(notGeneral) + ". Στις ζώνες Ολοημέρου γίνονται δεκτές μόνο τάξεις (π.χ. «Β'») και τμήματα Γενικής Παιδείας (π.χ. «Α1»), όπως στον Ολοήμερο Designer. Διόρθωσε το FET και ξαναδοκίμασε.");
    if (result.errors.length) return result;
    const unknownSets = unique([...activities.values()].flatMap(activity => activity.students.unknown));
    if (unknownSets.length) result.info.push('Σύνολα μαθητών του CSV που δεν υπάρχουν στο .fet: ' + unknownSets.map(quoted).join(', ') + '.');
    const others = unique([...activities.values()].flatMap(activity => activity.students.otherStudents));
    if (others.length) result.info.push('Ομάδες μαθητών του FET που δεν είναι τμήματα: ' + others.map(quoted).join(', ') + '. Μένουν στις δραστηριότητες με το όνομά τους, χωρίς τμήμα. Ένα τμήμα που δεν είναι Γενικής Παιδείας (π.χ. «Τμήμα Ένταξης») αντιστοιχίζεται όταν υπάρχει με το ίδιο όνομα στα «Τμήματα».');
    result.newClasses = clone(sortClasses(resolver.newClasses));
    if (result.newClasses.length) result.warnings.push('Θα δημιουργηθούν τα τμήματα: ' + result.newClasses.map(item => item.name).join(', ') + '.');

    if (input.replacing?.source?.modifiedAfterImport?.replacements?.length) {
      result.warnings.push('Το πρόγραμμα που αντικαθίσταται είχε τροποποιηθεί μετά την εισαγωγή με αντικαταστάσεις εκπαιδευτικών (' + input.replacing.source.modifiedAfterImport.replacements.map(item => (item.fromName || '?') + ' → ' + (item.toName || '?')).join(', ') + '). Βεβαιώσου ότι οι αντικαταστάσεις έχουν περάσει και στο FET.');
    }

    result.counts = {activities: activities.size, rows: rows.length, teachers: teacherNames.length, matched: teacherNames.length - result.unmatchedTeachers.length};
    result.ok = true;
    // Για τη δεύτερη φάση (buildFetProgram). Δεν προορίζονται για εμφάνιση.
    Object.defineProperty(result, 'plan', {enumerable: false, value: {activities, fet, teacherMatch, hours, dayNumber}});
    return result;
  }

  // Κατασκευή του προγράμματος από την ανάλυση (δεύτερη φάση). Τα νέα τμήματα της ανάλυσης
  // (analysis.newClasses) τα αποθηκεύει η εφαρμογή μαζί με το πρόγραμμα.
  //   options: {unmatched:'keep'|'drop', kind ('school'), name, periodId, now}.
  function buildFetProgram(analysis, options = {}) {
    if (!analysis?.ok || !analysis.plan) throw Error('Η εισαγωγή δεν μπορεί να γίνει: ' + (analysis?.errors?.[0] || 'δεν έγινε ανάλυση.'));
    const {activities, fet, teacherMatch, dayNumber} = analysis.plan;
    const keepUnmatched = options.unmatched !== 'drop', at = options.now || nowIso();
    const hourByName = new Map(analysis.plan.hours.map(item => [item.name, item]));
    const programActivities = [], sourceActivities = {};
    for (const activity of activities.values()) {
      const id = 'fet-' + activity.fetId, students = activity.students;
      const matched = activity.teachers.map(name => teacherMatch.get(name)).filter(Boolean);
      const unmatched = keepUnmatched ? activity.teachers.filter(name => !teacherMatch.get(name)) : [];
      programActivities.push({id, subject: activity.subject, staff: unique(matched), unmatched: unique(unmatched), classes: [...students.classes], subsets: [...students.subsets], otherStudents: [...students.otherStudents], room: activity.room, times: clone(activity.times)});
      sourceActivities[id] = {fetId: activity.fetId, tags: fet.activities.get(activity.fetId)?.tags || activity.csvTags, students: activity.studentsSets};
    }
    const unavailable = fet.unavailable.map(item => {
      const hour = hourByName.get(item.hour), day = dayNumber(item.day);
      return hour && day ? {teacher: item.teacher, day, hour: item.hour, start: hour.start, end: hour.end, weight: item.weight} : null;
    }).filter(Boolean);
    return {
      id: options.id || uid(), formatVersion: 2, kind: options.kind || 'school', periodId: options.periodId ?? null,
      name: options.name || '', createdAt: at, updatedAt: at,
      activities: programActivities,
      source: {
        type: 'fet', csvName: analysis.csvName, fetName: analysis.fetName, importedAt: at,
        activities: sourceActivities,
        students: fet.students,
        teachers: fet.teachers.map(teacher => ({...teacher, staffId: teacherMatch.get(teacher.name) ?? null})),
        unavailable, subjects: fet.subjects,
        modifiedAfterImport: null, oloimero: null
      },
      history: [{at, type: 'import', importer: 'fet', files: [analysis.csvName, analysis.fetName].filter(Boolean), activities: programActivities.length}]
    };
  }

  // ---- Εισαγωγείς ----
  // Ένας εισαγωγέας λέει πώς φτιάχνεται ένα πρόγραμμα ενός είδους από εξωτερικά αρχεία, σε δύο φάσεις.
  // Τον χρησιμοποιούν οι «Περίοδοι Προγραμμάτων» (προγράμματα περιόδων) και η εφαρμογή-κάτοχος του είδους,
  // με τον κοινό διάλογο schoolProgramImport του _ui.js. Τα αρχεία τα διαβάζει το host.
  //   id         μοναδικό μέσα στο είδος (π.χ. 'fet')
  //   label      η ενέργεια για τον χρήστη (π.χ. «Εισαγωγή από FET»)
  //   intro      τι αρχεία ζητά, για τον διάλογο
  //   files      [{key, label, description, accept:{mime:[καταλήξεις]}}]: τα αρχεία, με τη σειρά τους
  //   analyze(files, {staff, classes, classLimit, teachingHours, replacing})
  //              files: {key: {name, text}}· classes: τα Τμήματα του έτους, μαζί με όσα δεν έχουν αποθηκευτεί
  //              ακόμη· classLimit: το όριο πλήθους τμημάτων (από τα limits του context).
  //              → {ok, errors, warnings, info, unmatchedTeachers, newClasses, summary:[{value, label}]}.
  //              newClasses: τα τμήματα που θα δημιουργηθούν, με τελικά id· η εφαρμογή τα στέλνει στο host με
  //              την ίδια «Αποθήκευση» με το πρόγραμμα. Όταν υπάρχουν, η ανάλυση έχει και προειδοποίηση («Θα
  //              δημιουργηθούν τα τμήματα: …»), ώστε ο διάλογος εισαγωγής να ανοίγει πάντα.
  //   build(analysis, {unmatched:'keep'|'drop', kind, periodId, name, id, now}) → το πρόγραμμα
  function fetImporter() {
    return Object.freeze({
      id: 'fet',
      label: 'Εισαγωγή από FET',
      intro: 'Επίλεξε το CSV ωρολογίου («…_timetable.csv») και το αρχείο .fet από το οποίο βγήκε.',
      files: Object.freeze([
        Object.freeze({key: 'csv', label: 'CSV ωρολογίου', description: 'CSV ωρολογίου του FET', accept: Object.freeze({'text/csv': ['.csv']})}),
        Object.freeze({key: 'fet', label: 'Αρχείο .fet', description: 'Αρχείο FET', accept: Object.freeze({'application/xml': ['.fet']})})
      ]),
      analyze(files, options = {}) {
        const analysis = analyzeFetImport({csvText: files.csv?.text, csvName: files.csv?.name, fetText: files.fet?.text, fetName: files.fet?.name, staff: options.staff, classes: options.classes, classLimit: options.classLimit, teachingHours: options.teachingHours, replacing: options.replacing});
        if (analysis.ok) {
          const preview = buildFetProgram(analysis, {unmatched: 'keep'});
          analysis.summary = [
            {value: analysis.counts.activities, label: 'δραστηριότητες'},
            {value: analysis.counts.rows, label: 'ώρες στο πρόγραμμα'},
            {value: unique(preview.activities.flatMap(activity => activity.classes)).length, label: 'τμήματα'},
            {value: analysis.counts.matched + '/' + analysis.counts.teachers, label: 'εκπαιδευτικοί με αντιστοίχιση'}
          ];
          if (analysis.newClasses.length) analysis.summary.push({value: analysis.newClasses.length, label: 'νέα τμήματα'});
        }
        return analysis;
      },
      build: (analysis, options = {}) => buildFetProgram(analysis, options)
    });
  }

  Object.assign(parts, {DAY_KEYS, DAY_LABELS, timedHours, periodEnd, combineStudents, subsetParent, studentsParts,
    expandGrade, studentsText, activitySubject, ensureHistory, addHistory, tagSets, tagsOf, sameKey, OLOIMERO_CATEGORIES,
    composePeriod, oloimeroDiff});

  window.SchoolCsv =Object.freeze({parse, quote, detectDelimiter, staffCsvRead, staffCsvUpdate, staffCsvSuggest});
  window.SchoolFet = Object.freeze({parse: parseFet, child, children, text});
  // Το παγώνει το _data_oloimero.js, αφού προσθέσει τα μέλη του Ολοημέρου.
  window.SchoolTimetable = {
    kinds: KINDS, countsInHours, importers: importersOf, importer: importerOf, hourGroupKeys: HOUR_GROUPS, dayLabels: DAY_LABELS,
    STAY_MINUTES, EARLY_ARRIVAL_MINUTES,
    parseTimeRange, hourTimes, timedHours, hourGroups,
    PERIOD_STATUSES, isDraftPeriod, officialPeriods, sortPeriods, periodNumbers, periodEnd, periodAt, programAt, programsAt, periodWarnings,
    classSpelling, studentsIndex, expandStudents, studentsFromNames, studentsText, activitySubject, activitySubjectDetails, homeroomTeacher, isGeneralTeacher, sortStaff, sortStaffAlphabetically,
    conflicts, studentsClash, unavailableTimes, availability, staffBusyAt, replaceStaff,
    OLOIMERO_CATEGORIES, hourZone, composePeriod, compositionAt, moveProblems, oloimeroDiff,
    HISTORY_LIMIT, history: programHistory, ensureHistory, addHistory,
    programState, initialSnapshot, initialProgram, isModified, keepInitial, restoreInitial, setInitial,
    OLOIMERO_HOURS_MAX, oloimeroAvailableHours,
    INDIVIDUAL_CLASS_SUBJECT_SERVICES, individualClassSubject, INDIVIDUAL_SUPPORT_SERVICES, INDIVIDUAL_COMMON_SUBJECTS, isCommonSubject, supportActivity, individualProgram, individualRefresh, individualCopy,
    compositionProblems, BACKUP_APP, periodBackup, readPeriodBackup, analyzePeriodRestore, buildPeriodRestore,
    analyzeFetImport, buildFetProgram
  };
  parts.loaded('_data_timetable.js');
})();
