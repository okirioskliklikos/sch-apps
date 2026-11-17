/*
 * Εφαρμογές σχολείου — Κοινές λειτουργίες δεδομένων: CSV, FET, προγράμματα
 * Έκδοση αρχείου: 0.01
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
 *                           εμφάνιση μαθητών, συγκρούσεις, ώρες ανά εκπαιδευτικό, διαθεσιμότητα,
 *                           αντικαταστάσεις, εισαγωγή από FET, δάσκαλοι και σειρά του Προσωπικού, κανονική γραφή
 *                           τμημάτων, απασχόληση εκπαιδευτικών σε ημερομηνία και ώρα (συνεδριάσεις), Ιστορικό
 *                           προγράμματος, μάθημα δραστηριότητας (και «μάθημα της τάξης» των Ατομικών Προγραμμάτων),
 *                           Ατομικά Προγράμματα (νέο πρόγραμμα, δραστηριότητες από τα κελιά, αντιγραφή ανά
 *                           εκπαιδευτικό). Δεν είναι ακόμη παγωμένο: το _data_oloimero.js προσθέτει τα μέλη του
 *                           Ολοημέρου και τον εισαγωγέα του, και το παγώνει.
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
  //   counts: μετρά στις ώρες και στη διαθεσιμότητα· drafts: έχει προσχέδια (τα Ατομικά Προγράμματα όχι: ανήκουν
  //   πάντα σε περίοδο)· history: κρατά Ιστορικό (program.history)·
  //   importers: οι εισαγωγείς του είδους (βλέπε «Εισαγωγείς» παρακάτω)· κενό όταν δεν υπάρχει εισαγωγή.
  // Νέο είδος: μια εγγραφή εδώ (με εισαγωγέα, αν η εφαρμογή του εξάγει αρχείο), και στο host τα
  // δικαιώματα και ο validator του source.
  // Ο εισαγωγέας του Ολοημέρου μπαίνει στο oloimero.importers από το _data_oloimero.js, που μετά παγώνει τη λίστα.
  const KINDS = Object.freeze({
    school: Object.freeze({label: 'Ωρολόγιο', owner: 'fet_timetable_editor.html', ownerTitle: 'FET Timetable Editor', counts: true, drafts: true, history: true, importers: Object.freeze([fetImporter()])}),
    oloimero: Object.freeze({label: 'Ολοήμερο', owner: 'oloimero_designer.html', ownerTitle: 'Ολοήμερο Designer', counts: false, drafts: true, history: false, importers: []}),
    individual: Object.freeze({label: 'Ατομικά Προγράμματα', owner: 'individual_programs.html', ownerTitle: 'Ατομικά Προγράμματα', counts: true, drafts: false, history: true, importers: Object.freeze([])})
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

  // Η περίοδος που ισχύει σε μια ημερομηνία: σε επικάλυψη, αυτή που είναι πιο κάτω στη λίστα.
  function periodAt(periods, date) {
    const list = periods || [];
    for (let i = list.length - 1; i >= 0; i--) if (periodCovers(list[i], date)) return list[i];
    return null;
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

  // Προειδοποιήσεις για τη λίστα περιόδων (δεν εμποδίζουν την αποθήκευση):
  //   overlap: επικάλυψη δύο περιόδων· openEnd: κενό «έως» σε περίοδο που δεν είναι τελευταία·
  //   order: «έως» πριν από το «από».
  // Κάθε προειδοποίηση: {type, periodIds, message}.
  function periodWarnings(periods) {
    const list = periods || [], warnings = [];
    list.forEach((period, index) => {
      if (!period.to && index < list.length - 1) warnings.push({type: 'openEnd', periodIds: [period.id], message: 'Η περίοδος ' + quoted(period.name) + ' δεν έχει ημερομηνία λήξης, αλλά δεν είναι η τελευταία της λίστας.'});
      if (period.to && period.from && period.to < period.from) warnings.push({type: 'order', periodIds: [period.id], message: 'Η περίοδος ' + quoted(period.name) + ' λήγει πριν αρχίσει.'});
    });
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (!isoValid(a.from) || !isoValid(b.from) || (a.to && a.to < a.from) || (b.to && b.to < b.from)) continue;
      const from = a.from > b.from ? a.from : b.from;
      const endA = periodEnd(a), endB = periodEnd(b);
      const to = endA < endB ? endA : endB;
      if (!to || to < from) continue;
      warnings.push({type: 'overlap', periodIds: [a.id, b.id], from, to, message: 'Οι περίοδοι ' + quoted(a.name) + ' και ' + quoted(b.name) + ' επικαλύπτονται: ' + (to ? 'στις ' : '') + dateRangeText(from, to) + ' ισχύει η ' + quoted(b.name) + '.'});
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
  // ίδια ώρα τα τμήματα της δραστηριότητας στο Ωρολόγιο (kind 'school') των ctx.programs (ο καλών δίνει τα
  // προγράμματα της ίδιας περιόδου· τα άλλα είδη αγνοούνται). Υπολογίζεται κατά την ανάγνωση, ώστε να μένει
  // σωστό όταν αλλάξει το Ωρολόγιο, και δεν αποθηκεύεται.
  //   ctx: {programs, classes}. → {text, groups:[{subjects:[…], classIds:[…]}], missing:[classId…]}
  //   Τα τμήματα με τα ίδια μαθήματα γίνονται μία ομάδα. Μία ομάδα → «Γλώσσα»· περισσότερες →
  //   «Γλώσσα (Β1, Β2), Μαθηματικά (Γ1)». Τμήμα με δύο μαθήματα την ίδια ώρα (π.χ. υποσύνολα) → «Αγγλικά / Γαλλικά».
  //   Τμήμα χωρίς μάθημα εκείνη την ώρα: μόνο στο missing· κανένα μάθημα → κενό κείμενο.
  function activitySubjectDetails(activity, ctx = {}) {
    if (!activity?.subjectFromClasses) return {text: String(activity?.subject ?? '').trim(), groups: [], missing: []};
    const times = (activity.times || []).filter(isObject);
    const school = (Array.isArray(ctx.programs) ? ctx.programs : [ctx.programs]).filter(program => program?.kind === 'school');
    const byId = classesById(ctx.classes || []);
    const ids = unique((activity.classes || []).filter(Boolean));
    const order = new Map(sortClasses(ids.map(id => byId.get(id)).filter(Boolean)).map((record, index) => [record.id, index]));
    ids.sort((a, b) => (order.has(a) ? order.get(a) : Infinity) - (order.has(b) ? order.get(b) : Infinity));
    const groups = new Map(), missing = [];
    for (const id of ids) {
      const subjects = [];
      for (const program of school) for (const other of program.activities || []) {
        if (!(other.classes || []).includes(id) || !(other.times || []).some(time => times.some(own => timesOverlap(own, time)))) continue;
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

  // ---- Ώρες ανά εκπαιδευτικό ----
  // Ώρες στο πρόγραμμα ανά id του Προσωπικού (Map), μόνο από τα είδη που μετρούν. Μία ώρα ανά εγγραφή
  // του times· μια δραστηριότητα με δύο εκπαιδευτικούς μετρά και στους δύο.
  function staffHours(programs) {
    const hours = new Map();
    for (const program of Array.isArray(programs) ? programs : [programs]) {
      if (!program || !countsInHours(program.kind)) continue;
      for (const activity of program.activities || []) for (const id of unique(activity.staff || [])) hours.set(id, (hours.get(id) || 0) + (activity.times || []).length);
    }
    return hours;
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
  //   options: {programs, person (εγγραφή του Προσωπικού), day (1–5), teachingHours}.
  //   Μετρούν μόνο τα είδη που μετρούν στις ώρες. Η διευθύντρια/ο διευθυντής (role 'director') → null.
  // → {from, to, earlyAndAfternoon, hours:[{hour, name, start, end, category, status}]}, όπου status:
  //   'free' διαθέσιμος, 'busy' έχει δραστηριότητα, 'unavailable' μη διαθέσιμος στο FET,
  //   'outside' εκτός του εξαώρου. Τα διαλείμματα δεν περιλαμβάνονται.
  function availability({programs, person, day, teachingHours}) {
    if (!person || person.role === 'director') return null;
    const counted = (Array.isArray(programs) ? programs : [programs]).filter(program => program && countsInHours(program.kind));
    const hours = timedHours(teachingHours);
    const own = counted.flatMap(program => (program.activities || []).filter(activity => (activity.staff || []).includes(person.id)).flatMap(activity => activity.times || [])).filter(time => time.day === day);
    const blocked = counted.flatMap(program => unavailableTimes(program, person.id)).filter(time => time.day === day);
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
  // σύμφωνα με τα προγράμματα της περιόδου που ισχύει τότε. Μετρούν μόνο τα είδη που μετρούν στις ώρες.
  //   timetables: timetablesByYear[year] ({periods, programs})· date: 'YYYY-MM-DD'· start, end: 'HH:MM'.
  // → {period, programs, lesson:Set(id), unavailable:Set(id)}:
  //   lesson       έχουν δραστηριότητα που επικαλύπτει το διάστημα,
  //   unavailable  είναι μη διαθέσιμοι στο FET σε ώρα που επικαλύπτει το διάστημα (και δεν είναι στο lesson).
  //   period είναι null όταν καμία περίοδος δεν ισχύει στην ημερομηνία· programs κενό όταν η περίοδος
  //   δεν έχει πρόγραμμα που μετρά.
  function staffBusyAt(timetables, date, start, end) {
    const period = periodAt(timetables?.periods, date);
    const programs = period ? programsAt(timetables, date).filter(program => countsInHours(program.kind)) : [];
    const lesson = new Set(), unavailable = new Set();
    const day = isoValid(date) ? isoWeekday(date) : 0, from = minutes(start), to = minutes(end);
    if (!day || !(from < to)) return {period, programs, lesson, unavailable};
    const overlaps = time => time?.day === day && minutes(time.start) < to && from < minutes(time.end);
    for (const program of programs) {
      for (const activity of program.activities || []) {
        if ((activity.times || []).some(overlaps)) for (const id of activity.staff || []) lesson.add(id);
      }
    }
    for (const program of programs) {
      if (program.source?.type !== 'fet') continue;
      for (const teacher of program.source.teachers || []) {
        if (!teacher?.staffId || lesson.has(teacher.staffId)) continue;
        if (unavailableTimes(program, teacher.staffId).some(overlaps)) unavailable.add(teacher.staffId);
      }
    }
    return {period, programs, lesson, unavailable};
  }

  // ---- Αντικαταστάσεις ----
  // Αντίγραφο προγράμματος με αντικαταστάσεις εκπαιδευτικών [{from:id, to:id}] (Α → Β).
  //   options.staff: το Προσωπικό, για τα ονόματα της σημείωσης. Ένα πρόγραμμα από FET που άλλαξε
  //   σημειώνεται «τροποποιήθηκε μετά την εισαγωγή» (source.modifiedAfterImport), μαζί με τις αντικαταστάσεις.
  //   Σε σχέδιο του Ολοήμερου Designer αλλάζουν και οι επιλεγμένοι εκπαιδευτικοί του source, και στα Ατομικά
  //   Προγράμματα τα ελλιπή κελιά (source.pending).
  // → {program, changed}: changed = πόσες δραστηριότητες (και ελλιπή κελιά) άλλαξαν.
  function replaceStaff(program, replacements, options = {}) {
    const result = clone(program), map = new Map((replacements || []).filter(item => item.from && item.to && item.from !== item.to).map(item => [item.from, item.to]));
    // The history is fixed from the source before the source changes (see ensureHistory).
    ensureHistory(result);
    let changed = 0;
    const used = new Set();
    for (const activity of result.activities || []) {
      if (!(activity.staff || []).some(id => map.has(id))) continue;
      activity.staff.forEach(id => { if (map.has(id)) used.add(id); });
      activity.staff = unique(activity.staff.map(id => map.get(id) || id));
      changed++;
    }
    // The incomplete cells of the Ατομικά Προγράμματα belong to one teacher each.
    if (result.source?.type === 'individual' && Array.isArray(result.source.pending)) {
      for (const item of result.source.pending) if (map.has(item?.staffId)) { used.add(item.staffId); item.staffId = map.get(item.staffId); changed++; }
    }
    if (changed) {
      const person = id => (options.staff || []).find(item => item.id === id);
      const name = id => person(id)?.name || '';
      result.updatedAt = options.now || nowIso();
      if (result.source?.type === 'fet') {
        const note = result.source.modifiedAfterImport || {replacements: []};
        note.at = result.updatedAt;
        note.replacements = [...(note.replacements || []), ...[...used].map(id => ({from: id, fromName: name(id), to: map.get(id), toName: name(map.get(id))}))];
        result.source.modifiedAfterImport = note;
      }
      if (result.source?.type === 'oloimero-designer' && Array.isArray(result.source.teachers)) {
        const teachers = [];
        for (const teacher of result.source.teachers) {
          const to = map.get(teacher?.staffId);
          const next = to ? {...teacher, staffId: to, name: person(to)?.shortName || teacher.name} : teacher;
          if (!next.staffId || !teachers.some(item => item.staffId === next.staffId)) teachers.push(next);
        }
        result.source.teachers = teachers;
      }
    }
    return {program: result, changed};
  }

  // ---- Ιστορικό προγράμματος (program.history) ----
  // The events that created or changed a program of the Ωρολόγιο (kind 'school') or of the Ατομικά Προγράμματα
  // (kind 'individual'), newest first, at most
  // HISTORY_LIMIT. Only for information: nothing is undone from it. An entry is {at (ISO date and time), type, …}:
  //   'import'    {importer, files:[name…], activities}            import from files
  //   'copy'      {fromPeriod, replacements:[{fromName, toName}]}  copy from another period (individual:
  //               {fromPeriod, staff:[name…]}, the teachers that were copied)
  //   'oloimero'  {design, kept, removed, added, assigned}          Εισαγωγή Ολοημέρου (also with no change)
  //   'edit'      {activities}                                      manual changes, one entry per save (individual:
  //               {staff:[name…]}, the teachers whose program changed)
  // Names are written as they were at the time of the event. history:[] (after «Καθαρισμός Ιστορικού») stays
  // empty; a program without the key gets an initial history from what its source already has.
  const HISTORY_LIMIT = 20;
  const historyTime = entry => { const time = Date.parse(entry?.at); return Number.isNaN(time) ? 0 : time; };
  // The history of a program (a copy), newest first. Without the key: built from the source of a program from
  // FET (import and files, last Εισαγωγή Ολοημέρου, replacements and moves of modifiedAfterImport), with
  // derived:true, since times and counts there are not exact.
  function programHistory(program) {
    if (Array.isArray(program?.history)) return clone(program.history.filter(isObject));
    const source = program?.source, list = [];
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

  // ---- Ατομικά Προγράμματα (kind 'individual', source type 'individual', version 1) ----
  // One program per period, with the activities of every teacher that has an individual program, and no drafts.
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
  //   options: {unmatched:'keep'|'drop', kind ('school'), name, periodId (ή null για προσχέδιο), now}.
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
    expandGrade, studentsText, activitySubject, ensureHistory, addHistory, tagSets, tagsOf});

  window.SchoolCsv =Object.freeze({parse, quote, detectDelimiter, staffCsvRead, staffCsvUpdate, staffCsvSuggest});
  window.SchoolFet = Object.freeze({parse: parseFet, child, children, text});
  // Το παγώνει το _data_oloimero.js, αφού προσθέσει τα μέλη του Ολοημέρου.
  window.SchoolTimetable = {
    kinds: KINDS, countsInHours, importers: importersOf, importer: importerOf, hourGroupKeys: HOUR_GROUPS, dayLabels: DAY_LABELS,
    STAY_MINUTES, EARLY_ARRIVAL_MINUTES,
    parseTimeRange, hourTimes, timedHours, hourGroups,
    periodEnd, periodAt, programAt, programsAt, periodWarnings,
    classSpelling, studentsIndex, expandStudents, studentsFromNames, studentsText, activitySubject, activitySubjectDetails, homeroomTeacher, isGeneralTeacher, sortStaff, sortStaffAlphabetically,
    conflicts, studentsClash, staffHours, unavailableTimes, availability, staffBusyAt, replaceStaff,
    HISTORY_LIMIT, history: programHistory, ensureHistory, addHistory,
    INDIVIDUAL_CLASS_SUBJECT_SERVICES, individualClassSubject, individualProgram, individualRefresh, individualCopy,
    analyzeFetImport, buildFetProgram
  };
  parts.loaded('_data_timetable.js');
})();
