import type { Locale } from "../types";

/**
 * Словари интерфейса. Три языка с первого дня, kk — первым.
 * Копирайт: активный залог, действие названо тем, что происходит.
 */
export type Messages = {
  meta: { title: string; description: string };
  localeName: string;
  nav: { home: string; diagnose: string; path: string; dashboard: string; teacher: string };
  a11y: { switchLanguage: string; currentLanguage: string; skipToContent: string };
  home: {
    kicker: string;
    thesis: string;
    thesisAccent: string;
    lede: string;
    cta: string;
    ctaSecondary: string;
    contrastTitle: string;
    contrastOthers: string;
    contrastTamyr: string;
    strataTitle: string;
    strataHint: string;
  };
  graph: {
    gradeShort: string;
    stateMastered: string;
    stateTesting: string;
    stateLocked: string;
    stateRoot: string;
    blocks: string;
  };
  common: {
    soon: string; day: string; nodes: string; back: string; next: string;
    grade: string; of: string; question: string; startOver: string;
  };
  onboarding: {
    title: string; step: string;
    gradeTitle: string; gradeHint: string;
    subjectTitle: string; subjectHint: string; mathLabel: string; otherSoon: string;
    goalTitle: string; goalHint: string;
    goalEnt: string; goalSchool: string; goalCatchup: string;
    localeTitle: string; localeHint: string;
    start: string;
  };
  diagnose: {
    title: string; entryTitle: string; entryHint: string;
    check: string; skip: string; searching: string;
    phaseTarget: string; phaseDescent: string;
    phaseLanguageTarget: string; phaseLanguageRoot: string; phaseBoundary: string;
    traceTitle: string; traceEmpty: string;
    intervalLabel: string; confidenceWeak: string; confidenceStrong: string;
    demoted: string; askedOf: string;
  };
  result: {
    kicker: string; rootIs: string; gdiTitle: string;
    depth: string; breadth: string; centrality: string;
    depthHint: string; breadthHint: string; centralityHint: string;
    startedAt: string; gradesDown: string; questionsUsed: string;
    refinedTitle: string; refinedBody: string;
    barrierDetected: string; barrierNotAssessed: string;
    weakEvidence: string; truncated: string;
    toPath: string; retake: string;
  };
  node: {
    explanationTitle: string; basedOn: string; loading: string;
    unavailable: string; unavailableHint: string;
    langNote: string; chunkFallback: string; verificationFailed: string;
    tasksTitle: string; correct: string; wrong: string; whyWrong: string;
    nextTask: string; done: string; backToPath: string; taskCount: string;
  };
  dashboard: {
    title: string; lede: string; rootCard: string; gdiCard: string;
    progressCard: string; deadlineCard: string; daysLeft: string;
    mastered: string; ofTotal: string; empty: string; toNode: string;
  };
  teacher: {
    title: string; lede: string; classOf: string; averageGdi: string;
    deepestStudent: string;
    priorityTitle: string; priorityMetric: string; priorityHint: string;
    priorityStudents: string; priorityErrors: string;
    heatTitle: string; heatHint: string; showAll: string; hideAll: string;
    allNodesTitle: string; noGaps: string;
    legendRoot: string; legendError: string; legendBlocked: string;
    legendMastered: string; legendOut: string;
    formTitle: string; formHint: string; formNode: string; formText: string;
    formOption: string; formCorrect: string; formMisconception: string; formTag: string;
    formAdd: string; formAdded: string; formShowJson: string; formHideJson: string;
    formJsonHint: string; formRemove: string; formErrors: string; addedBadge: string;
  };
  path: {
    title: string; lede: string;
    stateRoot: string; stateNext: string; stateLocked: string;
    stateMastered: string; stateTarget: string;
    empty: string; backToResult: string;
  };
};

const kk: Messages = {
  meta: {
    title: "TAMYR AI — білімдегі түбірлік олқылықты табады",
    description:
      "TAMYR AI оқушының нені білмейтінін емес, неліктен білмейтінін табады: алғышарттар графы бойынша түбірлік олқылыққа дейін түседі.",
  },
  localeName: "Қазақша",
  nav: {
    home: "Басты бет",
    diagnose: "Диагностика",
    path: "Траектория",
    dashboard: "Кабинет",
    teacher: "Мұғалімге",
  },
  a11y: {
    switchLanguage: "Тілді ауыстыру",
    currentLanguage: "Ағымдағы тіл",
    skipToContent: "Мазмұнға өту",
  },
  home: {
    kicker: "Future Minds Hackathon 2026 · Social Impact",
    thesis: "Біз сіздің нені білмейтініңізді емес,",
    thesisAccent: "неліктен білмейтініңізді табамыз",
    lede: "Қате шыққанда біз тапсырманы жеңілдетпейміз. Алғышарттар графы бойынша төмен түсеміз — оқушы сенімді меңгерген алғашқы дағдыға дейін. Дәл сол — түбір.",
    cta: "Диагностикадан өту",
    ctaSecondary: "Графты қарау",
    contrastTitle: "Айырмашылық неде",
    contrastOthers:
      "Бейімделетін жүйелер: қате → сол тақырып ішінде жеңілірек тапсырма. Олқылық орнында қалады.",
    contrastTamyr:
      "TAMYR: қате → алғышарттар бойынша төмен түсу, түбірді табу, содан кейін төменнен жоғары қарай траектория.",
    strataTitle: "Қима",
    strataHint: "5-сынып төменде, 8-сынып жоғарыда. Олқылық неғұрлым терең болса, соғұрлым төмен жатыр.",
  },
  graph: {
    gradeShort: "сынып",
    stateMastered: "меңгерілген",
    stateTesting: "тексерілуде",
    stateLocked: "бекітулі",
    stateRoot: "түбірлік олқылық",
    blocks: "бағдарламаның {n}% бөгейді",
  },
  common: {
    soon: "жақында", day: "күн", nodes: "түйін", back: "Артқа", next: "Әрі қарай",
    grade: "сынып", of: "/", question: "Сұрақ", startOver: "Қайта бастау",
  },
  onboarding: {
    title: "Бірнеше сұрақ", step: "қадам",
    gradeTitle: "Сіз нешінші сыныпта оқисыз?", gradeHint: "Диагностика осы деңгейден басталады.",
    subjectTitle: "Пән", subjectHint: "Қазір бір ғана пән бар — бірақ шын тереңдікпен.",
    mathLabel: "Математика, 5–8 сынып", otherSoon: "Басқа пәндер кейін",
    goalTitle: "Мақсатыңыз қандай?", goalHint: "Траекторияның қарқынына әсер етеді.",
    goalEnt: "ҰБТ-ға дайындық", goalSchool: "Мектеп бағдарламасын қуып жету", goalCatchup: "Олқылықтарды жабу",
    localeTitle: "Тіл", localeHint: "Тапсырмалар мен түсіндірмелер осы тілде беріледі.",
    start: "Диагностиканы бастау",
  },
  diagnose: {
    title: "Диагностика", entryTitle: "Осы жерден бастадық", entryHint: "Сіз тұрып қалған түйін",
    check: "Жауапты тексеру", skip: "Білмеймін", searching: "Іздеу аймағы",
    phaseTarget: "Мақсатты түйінді тексереміз",
    phaseDescent: "Алғышарттар бойынша түсеміз",
    phaseLanguageTarget: "Мақсатта: мәселе тұжырымда емес пе екенін тексереміз",
    phaseLanguageRoot: "Түбірде: мәселе тұжырымда емес пе екенін тексереміз",
    phaseBoundary: "Түбір кандидатын нақтылаймыз",
    traceTitle: "Диагностика жолы", traceEmpty: "Бірінші жауаптан кейін қадамдар осында пайда болады.",
    intervalLabel: "аралық", confidenceWeak: "әлсіз дәлел", confidenceStrong: "расталған",
    demoted: "кандидатты төмендетті", askedOf: "сұрақ",
  },
  result: {
    kicker: "Түбір табылды", rootIs: "Сіздің түбіріңіз", gdiTitle: "Олқылық тереңдігінің индексі",
    depth: "Тереңдік", breadth: "Ауқым", centrality: "Бөгеуші орталықтық",
    depthHint: "Түбір сынып деңгейіңізден неше сынып төмен жатыр",
    breadthHint: "Ағымдағы деңгейде меңгерілмеген түйіндер үлесі",
    centralityHint: "Осы түйін бөгеп тұрған бағдарлама үлесі",
    startedAt: "Бастау нүктесі", gradesDown: "сынып төмен", questionsUsed: "сұрақ жеткілікті болды",
    refinedTitle: "Біз жеңіліне тоқтамадық",
    refinedBody: "Бинарлық іздеу алдымен басқа түйінді ұсынды, бірақ нақтылау оның алғышарты меңгерілмегенін көрсетті — сондықтан төмен түстік.",
    barrierDetected: "Тілдік кедергі байқалды: ұзақ тұжырымда қателестіңіз, қысқасын шештіңіз.",
    barrierNotAssessed: "Тілдік кедергі тексерілмеді: бұл түйіндерде жұп тапсырма жоқ.",
    weakEvidence: "Әлсіз дәлел: түйінде бір ғана тапсырма бар.",
    truncated: "Сұрақ шегі таусылды — түбір ең ықтимал баға болып табылады.",
    toPath: "Траекторияны көру", retake: "Диагностиканы қайталау",
  },
  node: {
    explanationTitle: "Түсіндірме", basedOn: "Бағдарлама бөлімі негізінде", loading: "Жүктелуде…",
    unavailable: "Бұл түйін бойынша материал әзірге жоқ.",
    unavailableHint: "Біз ойдан шығармаймыз: бағдарлама үзіндісі болмаса, түсіндірме де болмайды. Тапсырмалар төменде жұмыс істейді.",
    langNote: "Дереккөз орыс тілінде — бұл түйіннің аудармасы әзірге дайын емес.",
    chunkFallback: "Бағдарламаның бастапқы үзіндісі көрсетілген.",
    verificationFailed: "Жасалған мәтін тексеруден өтпеді, сондықтан бастапқы үзінді көрсетіліп тұр.",
    tasksTitle: "Тапсырмалар", correct: "Дұрыс", wrong: "Дұрыс емес", whyWrong: "Бұл жауап нені білдіреді",
    nextTask: "Келесі тапсырма", done: "Тапсырмалар аяқталды", backToPath: "Траекторияға оралу",
    taskCount: "тапсырма",
  },
  dashboard: {
    title: "Кабинет", lede: "Түбіріңіз, ілгерілеу және ҰБТ-ға дейінгі уақыт.",
    rootCard: "Түбірлік олқылық", gdiCard: "ОТИ", progressCard: "Меңгерілген түйіндер",
    deadlineCard: "ҰБТ-ға дейін", daysLeft: "күн",
    mastered: "меңгерілген", ofTotal: "барлығы", empty: "Алдымен диагностикадан өтіңіз.",
    toNode: "Түйінге өту",
  },
  teacher: {
    title: "Мұғалім панелі", lede: "Сынып қайда тұрып қалғаны және неден бастау керегі.",
    classOf: "оқушы", averageGdi: "Орташа ОТИ", deepestStudent: "Ең терең олқылық",
    priorityTitle: "Неден бастау керек",
    priorityMetric: "оқушының түбірлік олқылығы осы екі түйінде",
    priorityHint: "Негізгі көрсеткіш — оқушылар үлесі, қателер саны емес: қате абайсыздық болуы мүмкін, ал түбір анықтама бойынша олқылықты білдіреді.",
    priorityStudents: "оқушы", priorityErrors: "тіркелген қате",
    heatTitle: "Жылу картасы", heatHint: "Тек сыныпта нақты олқылық бар түйіндер көрсетілген.",
    showAll: "Барлық 75 түйінді көрсету", hideAll: "Жасыру",
    allNodesTitle: "Барлық түйіндер", noGaps: "олқылық жоқ",
    legendRoot: "түбір", legendError: "қате", legendBlocked: "бөгелген",
    legendMastered: "меңгерілген", legendOut: "бағдарламадан тыс",
    formTitle: "Тапсырма қосу", formHint: "Тапсырма осы браузерде сақталады және түйін бетінде бірден пайда болады.",
    formNode: "Түйін", formText: "Тапсырма мәтіні", formOption: "Нұсқа",
    formCorrect: "Дұрыс", formMisconception: "Бұл нұсқа нені білдіреді", formTag: "Қате түрі",
    formAdd: "Тапсырманы қосу", formAdded: "Қосылған тапсырмалар",
    formShowJson: "JSON көрсету", formHideJson: "JSON жасыру",
    formJsonHint: "Нақты коммитте questions.json файлына түсетін құрылым.",
    formRemove: "Жою", formErrors: "Мәтінді, кемінде екі нұсқаны және бір талдауды толтырыңыз.",
    addedBadge: "мұғалім қосқан",
  },
  path: {
    title: "Траектория", lede: "Төменнен жоғары қарай: түбірден мақсатқа дейін.",
    stateRoot: "түбір", stateNext: "келесі қадам", stateLocked: "бекітулі",
    stateMastered: "меңгерілген", stateTarget: "мақсат",
    empty: "Алдымен диагностикадан өтіңіз.", backToResult: "Нәтижеге оралу",
  },
};

const ru: Messages = {
  meta: {
    title: "TAMYR AI — находит корневой пробел в знаниях",
    description:
      "TAMYR AI находит не то, что ученик не знает, а то, почему: спускается по графу предпосылок до корневого пробела и строит траекторию снизу вверх.",
  },
  localeName: "Русский",
  nav: {
    home: "Главная",
    diagnose: "Диагностика",
    path: "Траектория",
    dashboard: "Кабинет",
    teacher: "Учителю",
  },
  a11y: {
    switchLanguage: "Сменить язык",
    currentLanguage: "Текущий язык",
    skipToContent: "Перейти к содержанию",
  },
  home: {
    kicker: "Future Minds Hackathon 2026 · Social Impact",
    thesis: "Мы находим не то, что вы не знаете,",
    thesisAccent: "а то, почему",
    lede: "При ошибке мы не упрощаем задание. Мы спускаемся вниз по графу предпосылок — на предыдущие классы, до первого навыка, которым ученик владеет уверенно. Это и есть корень.",
    cta: "Пройти диагностику",
    ctaSecondary: "Посмотреть граф",
    contrastTitle: "В чём разница",
    contrastOthers:
      "Адаптивные системы: ошибка → задание полегче внутри той же темы. Пробел остаётся на месте.",
    contrastTamyr:
      "TAMYR: ошибка → спуск по предпосылкам, поиск корня, затем траектория снизу вверх.",
    strataTitle: "Разрез",
    strataHint: "5 класс внизу, 8 наверху. Чем глубже пробел, тем ниже он лежит.",
  },
  graph: {
    gradeShort: "класс",
    stateMastered: "освоено",
    stateTesting: "проверяется",
    stateLocked: "закрыто",
    stateRoot: "корневой пробел",
    blocks: "блокирует {n}% программы",
  },
  common: {
    soon: "скоро", day: "дней", nodes: "узлов", back: "Назад", next: "Дальше",
    grade: "класс", of: "из", question: "Вопрос", startOver: "Начать заново",
  },
  onboarding: {
    title: "Несколько вопросов", step: "шаг",
    gradeTitle: "В каком классе вы учитесь?", gradeHint: "С этого уровня начнётся диагностика.",
    subjectTitle: "Предмет", subjectHint: "Пока один предмет — зато с настоящей глубиной.",
    mathLabel: "Математика, 5–8 класс", otherSoon: "Другие предметы позже",
    goalTitle: "Какая у вас цель?", goalHint: "Влияет на темп траектории.",
    goalEnt: "Подготовка к ЕНТ", goalSchool: "Успевать за школьной программой", goalCatchup: "Закрыть пробелы",
    localeTitle: "Язык", localeHint: "На нём будут задания и объяснения.",
    start: "Начать диагностику",
  },
  diagnose: {
    title: "Диагностика", entryTitle: "Отсюда начали", entryHint: "Узел, на котором вы застряли",
    check: "Проверить ответ", skip: "Не знаю", searching: "Область поиска",
    phaseTarget: "Проверяем целевой узел",
    phaseDescent: "Спускаемся по предпосылкам",
    phaseLanguageTarget: "Проверяем, не в формулировке ли дело — у цели",
    phaseLanguageRoot: "Проверяем, не в формулировке ли дело — у корня",
    phaseBoundary: "Уточняем кандидата в корень",
    traceTitle: "Путь диагностики", traceEmpty: "Шаги появятся здесь после первого ответа.",
    intervalLabel: "интервал", confidenceWeak: "слабое свидетельство", confidenceStrong: "подтверждено",
    demoted: "опустил кандидата", askedOf: "вопрос",
  },
  result: {
    kicker: "Корень найден", rootIs: "Ваш корень", gdiTitle: "Индекс глубины пробела",
    depth: "Глубина", breadth: "Широта", centrality: "Блокирующая центральность",
    depthHint: "На сколько классов ниже вашего уровня лежит корень",
    breadthHint: "Доля неосвоенных узлов на текущем уровне",
    centralityHint: "Какую часть программы этот узел блокирует",
    startedAt: "Точка входа", gradesDown: "класса вниз", questionsUsed: "вопросов хватило",
    refinedTitle: "Мы не остановились на том, что попроще",
    refinedBody: "Бинарный поиск сначала предложил другой узел, но уточняющий проход показал, что его предпосылка не освоена — и мы спустились ниже.",
    barrierDetected: "Замечен языковой барьер: ошибка на длинной формулировке, верный ответ на краткой.",
    barrierNotAssessed: "Языковой барьер не проверялся: на этих узлах нет парных заданий.",
    weakEvidence: "Слабое свидетельство: у узла всего одно задание.",
    truncated: "Лимит вопросов исчерпан — корень является наиболее вероятной оценкой.",
    toPath: "Смотреть траекторию", retake: "Пройти заново",
  },
  node: {
    explanationTitle: "Объяснение", basedOn: "Основано на разделе программы", loading: "Загружаем…",
    unavailable: "По этому узлу материала пока нет.",
    unavailableHint: "Мы не додумываем: нет фрагмента программы — нет и объяснения. Задания ниже работают.",
    langNote: "Источник на русском — перевод для этого узла пока не готов.",
    chunkFallback: "Показан исходный фрагмент программы.",
    verificationFailed: "Сгенерированный текст не прошёл проверку на заземление, поэтому показан исходный фрагмент.",
    tasksTitle: "Задания", correct: "Верно", wrong: "Неверно", whyWrong: "Что означает этот ответ",
    nextTask: "Следующее задание", done: "Задания закончились", backToPath: "Вернуться к траектории",
    taskCount: "заданий",
  },
  dashboard: {
    title: "Кабинет", lede: "Ваш корень, прогресс и время до ЕНТ.",
    rootCard: "Корневой пробел", gdiCard: "ИГП", progressCard: "Освоено узлов",
    deadlineCard: "До ЕНТ", daysLeft: "дней",
    mastered: "освоено", ofTotal: "всего", empty: "Сначала пройдите диагностику.",
    toNode: "Перейти к узлу",
  },
  teacher: {
    title: "Панель учителя", lede: "Где класс застрял и с чего начинать.",
    classOf: "учеников", averageGdi: "Средний ИГП", deepestStudent: "Самый глубокий пробел",
    priorityTitle: "С чего начинать",
    priorityMetric: "учеников, чей корневой пробел лежит в этих двух узлах",
    priorityHint: "Основная метрика — доля учеников, а не число ошибок: ошибка может быть невнимательностью, а корень означает пробел по построению.",
    priorityStudents: "учеников", priorityErrors: "зафиксированных ошибок",
    heatTitle: "Тепловая карта", heatHint: "Показаны только узлы, где у класса действительно есть пробелы.",
    showAll: "Показать все 75 узлов", hideAll: "Свернуть",
    allNodesTitle: "Все узлы программы", noGaps: "без пробелов",
    legendRoot: "корень", legendError: "ошибка", legendBlocked: "заблокировано",
    legendMastered: "освоено", legendOut: "вне программы",
    formTitle: "Добавить задание", formHint: "Задание сохранится в этом браузере и сразу появится на странице узла.",
    formNode: "Узел", formText: "Текст задания", formOption: "Вариант",
    formCorrect: "Верный", formMisconception: "Что означает этот вариант", formTag: "Тип ошибки",
    formAdd: "Добавить задание", formAdded: "Добавленные задания",
    formShowJson: "Показать JSON", formHideJson: "Скрыть JSON",
    formJsonHint: "Структура, которая ушла бы в questions.json при реальном коммите.",
    formRemove: "Удалить", formErrors: "Заполните текст, минимум два варианта и хотя бы один разбор.",
    addedBadge: "добавлено учителем",
  },
  path: {
    title: "Траектория", lede: "Снизу вверх: от корня к цели.",
    stateRoot: "корень", stateNext: "следующий шаг", stateLocked: "закрыто",
    stateMastered: "освоено", stateTarget: "цель",
    empty: "Сначала пройдите диагностику.", backToResult: "Вернуться к результату",
  },
};

const en: Messages = {
  meta: {
    title: "TAMYR AI — finds the root gap in a student's knowledge",
    description:
      "TAMYR AI finds not what a student doesn't know, but why: it descends the prerequisite graph to the root gap and rebuilds the path from the bottom up.",
  },
  localeName: "English",
  nav: {
    home: "Home",
    diagnose: "Diagnosis",
    path: "Path",
    dashboard: "Dashboard",
    teacher: "For teachers",
  },
  a11y: {
    switchLanguage: "Switch language",
    currentLanguage: "Current language",
    skipToContent: "Skip to content",
  },
  home: {
    kicker: "Future Minds Hackathon 2026 · Social Impact",
    thesis: "We find not what you don't know,",
    thesisAccent: "but why",
    lede: "On a wrong answer we don't simplify the task. We descend the prerequisite graph — into earlier grades, down to the first skill the student holds with confidence. That is the root.",
    cta: "Take the diagnosis",
    ctaSecondary: "See the graph",
    contrastTitle: "What makes it different",
    contrastOthers:
      "Adaptive systems: a wrong answer → an easier task inside the same topic. The gap stays where it was.",
    contrastTamyr:
      "TAMYR: a wrong answer → a descent through prerequisites, the root, then a path built bottom-up.",
    strataTitle: "The cross-section",
    strataHint: "Grade 5 at the bottom, grade 8 on top. The deeper the gap, the lower it sits.",
  },
  graph: {
    gradeShort: "grade",
    stateMastered: "mastered",
    stateTesting: "testing",
    stateLocked: "locked",
    stateRoot: "root gap",
    blocks: "blocks {n}% of the curriculum",
  },
  common: {
    soon: "soon", day: "days", nodes: "nodes", back: "Back", next: "Next",
    grade: "grade", of: "of", question: "Question", startOver: "Start over",
  },
  onboarding: {
    title: "A few questions", step: "step",
    gradeTitle: "What grade are you in?", gradeHint: "The diagnosis starts at this level.",
    subjectTitle: "Subject", subjectHint: "One subject for now — but with real depth.",
    mathLabel: "Mathematics, grades 5–8", otherSoon: "More subjects later",
    goalTitle: "What is your goal?", goalHint: "It sets the pace of your path.",
    goalEnt: "Prepare for the UNT", goalSchool: "Keep up with class", goalCatchup: "Close my gaps",
    localeTitle: "Language", localeHint: "Tasks and explanations will use it.",
    start: "Start the diagnosis",
  },
  diagnose: {
    title: "Diagnosis", entryTitle: "We started here", entryHint: "The node you got stuck on",
    check: "Check the answer", skip: "I don't know", searching: "Search range",
    phaseTarget: "Testing the target node",
    phaseDescent: "Descending through prerequisites",
    phaseLanguageTarget: "Checking whether the wording is the problem — at the target",
    phaseLanguageRoot: "Checking whether the wording is the problem — at the root",
    phaseBoundary: "Refining the root candidate",
    traceTitle: "Diagnosis path", traceEmpty: "Steps will appear here after your first answer.",
    intervalLabel: "range", confidenceWeak: "weak evidence", confidenceStrong: "verified",
    demoted: "ruled out the candidate", askedOf: "question",
  },
  result: {
    kicker: "Root found", rootIs: "Your root", gdiTitle: "Gap Depth Index",
    depth: "Depth", breadth: "Breadth", centrality: "Blocking centrality",
    depthHint: "How many grades below your level the root sits",
    breadthHint: "Share of unmastered nodes at your current level",
    centralityHint: "How much of the curriculum this node blocks",
    startedAt: "Entry point", gradesDown: "grades down", questionsUsed: "questions were enough",
    refinedTitle: "We did not settle for the easier answer",
    refinedBody: "The binary search first proposed a different node, but the refinement pass found one of its prerequisites unmastered — so we went deeper.",
    barrierDetected: "Language barrier detected: wrong on the long wording, right on the short one.",
    barrierNotAssessed: "Language barrier not assessed: these nodes have no paired tasks.",
    weakEvidence: "Weak evidence: this node has only one task.",
    truncated: "Question limit reached — the root is the most likely estimate.",
    toPath: "See the path", retake: "Take it again",
  },
  node: {
    explanationTitle: "Explanation", basedOn: "Based on the curriculum section", loading: "Loading…",
    unavailable: "No material for this node yet.",
    unavailableHint: "We do not make things up: no curriculum excerpt means no explanation. The tasks below still work.",
    langNote: "Source is in Russian — a translation for this node is not ready yet.",
    chunkFallback: "Showing the original curriculum excerpt.",
    verificationFailed: "The generated text failed the grounding check, so the original excerpt is shown instead.",
    tasksTitle: "Tasks", correct: "Correct", wrong: "Incorrect", whyWrong: "What this answer means",
    nextTask: "Next task", done: "No more tasks", backToPath: "Back to the path",
    taskCount: "tasks",
  },
  dashboard: {
    title: "Dashboard", lede: "Your root, your progress, and the time left.",
    rootCard: "Root gap", gdiCard: "GDI", progressCard: "Nodes mastered",
    deadlineCard: "Until the UNT", daysLeft: "days",
    mastered: "mastered", ofTotal: "total", empty: "Take the diagnosis first.",
    toNode: "Open the node",
  },
  teacher: {
    title: "Teacher panel", lede: "Where the class is stuck and where to start.",
    classOf: "students", averageGdi: "Average GDI", deepestStudent: "Deepest gap",
    priorityTitle: "Where to start",
    priorityMetric: "of students have their root gap in these two nodes",
    priorityHint: "The headline metric is the share of students, not the count of errors: an error can be carelessness, while a root gap is a gap by construction.",
    priorityStudents: "students", priorityErrors: "recorded errors",
    heatTitle: "Heat map", heatHint: "Only nodes where the class actually has gaps are shown.",
    showAll: "Show all 75 nodes", hideAll: "Collapse",
    allNodesTitle: "All curriculum nodes", noGaps: "no gaps",
    legendRoot: "root", legendError: "error", legendBlocked: "blocked",
    legendMastered: "mastered", legendOut: "out of scope",
    formTitle: "Add a task", formHint: "The task is stored in this browser and appears on the node page right away.",
    formNode: "Node", formText: "Task text", formOption: "Option",
    formCorrect: "Correct", formMisconception: "What this option means", formTag: "Error type",
    formAdd: "Add the task", formAdded: "Added tasks",
    formShowJson: "Show JSON", formHideJson: "Hide JSON",
    formJsonHint: "The structure that would go into questions.json on a real commit.",
    formRemove: "Remove", formErrors: "Fill in the text, at least two options and one explanation.",
    addedBadge: "added by teacher",
  },
  path: {
    title: "Path", lede: "Bottom-up: from the root to the target.",
    stateRoot: "root", stateNext: "next step", stateLocked: "locked",
    stateMastered: "mastered", stateTarget: "target",
    empty: "Take the diagnosis first.", backToResult: "Back to the result",
  },
};

/** Порядок важен: kk первым в переключателе. */
export const messages: Record<Locale, Messages> = { kk, ru, en };
