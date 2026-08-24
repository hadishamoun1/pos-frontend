// src/translations/ar.js
export const ar = {
  // Year Settings Page
  yearSettings: {
    title: "إعدادات السنة المالية",
    currentActiveYear: "السنة النشطة الحالية",
    noActiveYear: "لم يتم تعيين سنة مالية نشطة.",
    addNewYear: "إضافة سنة جديدة",
    yearLabel: "السنة:",
    yearPlaceholder: "مثال: 2025 أو 25",
    addYearButton: "إضافة سنة",
    setActiveYear: "تعيين السنة النشطة",
    yearToActivateLabel: "السنة المراد تفعيلها:",
    yearToActivatePlaceholder: "أدخل سنة موجودة",
    setAsActiveButton: "تعيين كنشطة",
    saving: "جاري الحفظ...",
    yearAddedSuccess: "تمت إضافة السنة {year} بنجاح.",
    activeYearSetSuccess: "تم تعيين السنة المالية النشطة إلى {year}.",
    enterYearError: "الرجاء إدخال السنة التي تريد إضافتها.",
    enterActiveYearError: "الرجاء إدخال السنة التي تريد تعيينها كنشطة.",
    loadError: "فشل تحميل السنة المالية النشطة.",
    addError: "حدث خطأ أثناء إضافة السنة.",
    setActiveError: "حدث خطأ أثناء تعيين السنة النشطة.",
  },

  // Language Settings
  languageSettings: {
    title: "إعدادات اللغة",
    currentLanguage: "اللغة الحالية",
    selectLanguage: "اختر اللغة",
    english: "الإنجليزية",
    arabic: "العربية",
    changeLanguage: "تغيير اللغة",
  },

  // Inventory Table
  inventoryTable: {
    // Headers
    rtn: "إرجاع",
    rtnQty: "كمية الإرجاع",
    origin: "المنشأ",
    condition: "الحالة",
    item: "المنتج",
    type: "النوع",
    length: "الطول",
    width: "العرض",
    box: "صندوق",
    sheet: "ورقة",
    price: "السعر",
    sqm: "متر مربع",
    total: "المجموع",

    // Placeholders
    lengthPlaceholder: "الطول",
    widthPlaceholder: "العرض",
    enterBoxes: "أدخل الصناديق…",
    sheetsPerBox: "أوراق/صندوق…",
    enterQty: "أدخل الكمية…",
    enterSheets: "أدخل الأوراق…",

    // Messages
    noItems: 'لا توجد عناصر محددة. انقر على "بحث" لإضافة منتجات.',
  },

  // Customer Details
  customerDetails: {
    companyName: "اسم الشركة",
    customerName: "اسم العميل",
    searchCustomer: "ابحث عن اسم العميل",
    searchItems: "البحث عن المنتجات",
    cut: "قص",
    cutOn: "قص (تشغيل)",
    getPrice: "الحصول على السعر",
    viewHistory: "عرض السجل",
  },

  // Stock Tab / Search Modal
  stockTab: {
    // Headers
    select: "اختر",
    item: "المنتج",
    type: "النوع",
    length: "الطول",
    stockBox: "مخزون الصناديق",
    stockSheet: "مخزون الألواح",
    origin: "المنشأ",
    condition: "الحالة",
    dateReceived: "تاريخ الاستلام",

    // Buttons & Labels
    clear: "مسح",
    selected: "المحدد",
    allOrigins: "جميع المنشأ",
    allTypes: "جميع الأنواع",
    loadMore: "تحميل المزيد",
    loading: "جاري التحميل...",
    noMoreItems: "لا توجد عناصر إضافية",
    noData: "لا توجد بيانات",
    page: "صفحة",
    showing: "عرض",
    rows: "صفوف",

    // Repeat Modal
    sqmRepetitions: "تكرارات المتر المربع",
    howManyTimes: "كم مرة تريد إضافته؟",
    cancel: "إلغاء",
    ok: "موافق",

    // Search Placeholder
    searchPlaceholder:
      "اكتب ثم Enter — مثال: 5.5ملم ابيض  |  225*321-012  |  225 321",
  },

  // Search Modal
  searchModal: {
    title: "بحث",
    tabsAriaLabel: "تبويبات نتائج البحث",
    okWithCount: "موافق ({count})",
    noPermissionsError: "خطأ! الرجاء الاتصال بالمسؤول.",
    tabs: {
      stock: "البضاعة الموجودة",
      all: "الكل",
      sqm: "قطع المتر المربع",
      media: "أصناف بصورة",
    },
  },

  // POS CustomerDetails (extra titles)
  posCustomerDetails: {
    clickEditFirst: "اضغط تعديل أولاً",
    currency: "العملة",
    viewHistoryTitle: "عرض سجل أسعار العميل",
  },

  // POS Toolbar
  posToolbar: {
    new: "جديد",
    editInvoice: "تعديل الفاتورة",
    request: "طلب",
    editRequest: "تعديل الطلب",
    issue: "فاتورة رسمية",
    offer: "عرض",
    rvr: "RVR",
    rvrTitle: "RVR",

    saveRequest: "حفظ الطلبية",
    saveInvoice: "حفظ الفاتورة",

    return: "إرجاع",
    returnSelectedWithCount: "إرجاع المحدد ({count})",
    cancelReturn: "إلغاء الإرجاع",

    returnNotAvailable: "الإرجاع غير متاح لهذه الفاتورة",
    finishEditingBeforeReturning: "أنهِ التعديل قبل الإرجاع",
    selectItemsToReturn: "اختر العناصر لإرجاعها",
    createReturnFromSelectedTitle: "إنشاء فاتورة إرجاع من الصفوف المحددة",
    cancelReturnSelectionTitle: "إلغاء تحديد الإرجاع",

    viewInvoice: "عرض الفاتورة",
    viewRequest: "عرض الطلب",

    deliveryNoteShort: "سند تسليم",
    deliveryNoteForRequest: "سند تسليم للطلب",
    deliveryNoteForInvoice: "سند تسليم للفاتورة",
    selectRequestOrInvoiceFirst: "اختر طلبًا أو فاتورة أولاً",

    statementShort: "كشف",
    statementTitle: "كشف حساب",
    openStatementAria: "فتح كشف الحساب",
  },

  // Dashboard
  dashboard: {
    title: "مركز الأعمال",
    subtitle: "تنقّل بين الوحدات لإدارة عملياتك بكفاءة",
    sections: {
      posSystem: "نظام نقاط البيع",
      recievables: "الذمم المدينة",
      rvrRecievables: "ذمم RVR",
      warehouseStock: "مخزون المستودعات",
      zeroVatInvoices: "فواتير بدون ضريبة",
      inventory: "المخزون",
      customers: "العملاء",
      purchasesInvoice: "فاتورة المشتريات",
      settings: "الإعدادات",
      suppliers: "الموردون",
      items: "الأصناف",
      costEstimator: "حاسبة التكلفة",
      accounts: "الحسابات",
      payments: "الدفعات",
      transactions: "القيود",
      inventoryActivity: "حركة المخزون",
      reports: "التقارير",
      sqm: "متر مربع",
      cutsControl: "إدارة القص",
      viewing: "عرض الفواتير",
      cashCollections: "تحصيلات النقد",
      employeeFiles: "ملفات الموظفين",
      activityMonitor: "مراقبة النشاط",
      users: "المستخدمون",
      faceEnroll: "تسجيل بصمة الوجه",
      recording: "التحكم بالتسجيل",
      rvrRandomizer: "موزع RVR العشوائي",
      invoiceTypeConverter: "محوّل نوع الفاتورة",
      receivableTypeConverter: "محوّل نوع المقبوضات",
      receivableSequenceAudit: "مراجعة تسلسل المقبوضات",
    },
  },

  // Receivables (merged + cleaned ✅)
  receivables: {
  newRecord: {
    title: "سجل جديد",
    addRow: "إضافة سطر",
    addAtLeastOneRowTitle: "أضف سطرًا واحدًا على الأقل",
    pickCustomerTitle: "اضغط لاختيار العميل",
    headers: {
      customerName: "اسم العميل",
      type: "النوع",
      paymentType: "نوع الدفع",
      currency: "العملة",
      cashNumber: "رقم النقد",
      exchangeRate: "سعر الصرف",
      amountEx: "المبلغ المحوّل",
      date: "التاريخ",
      invoiceNumber: "رقم الفاتورة",
      comments: "ملاحظات",
    },
  },

  invoiceTitleWithNumber: "فاتورة {number}",

  invoicePicker: {
    invoiceNumber: "رقم الفاتورة",
    date: "التاريخ",
    noVat: "بدون ضريبة",
    vat: "الضريبة",
    total: "الإجمالي",
    none: "— بدون —",
    loadingInvoices: "جاري تحميل الفواتير...",
    noInvoicesForCustomer: "لا توجد فواتير لهذا العميل.",
    loadMore: "تحميل المزيد",
    loadingMore: "جاري التحميل...",
  },

  types: { G: "G", S: "S", RVR: "RVR" },

  paymentTypes: {
    cash: "نقداً",
    check: "شيك",
  },

  messages: {
    savedSuccessfully: "تم الحفظ بنجاح!",
    deletedSuccessfully: "تم الحذف بنجاح.",
    noJournalVoucherFound: "لا يوجد قيد يومية لهذا السجل.",
  },

  // ✅ THIS MUST EXIST because your AccountingPage uses receivables.page.errors....
  page: {
    searchPlaceholder: "ابحث بالعميل أو رقم القيد",
    buttons: {
      new: "جديد",
      statementShort: "كشف",
      viewJv: "عرض القيد",
      dailyReport: "تقرير يومي",
      receipt: "إيصال",
    },
    titles: {
      selectRowFirst: "اختر سطرًا أولاً",
      openStatementForSelectedCustomer: "فتح كشف الحساب للعميل المحدد",
      selectReceiptEntryFirst: "اختر قيدًا أولاً",
      viewJournalVoucherForSelectedEntry: "عرض قيد اليومية للسطر المحدد",
      viewDailyReceivables: "عرض تقرير الذمم اليومي",
    },
    loadingData: "جاري تحميل البيانات...",
    searching: "جاري البحث…",
    confirmDeleteMessage: "هل أنت متأكد أنك تريد حذف هذا السجل؟",
    table: {
      selectRowAria: "اختيار السطر",
      customerName: "اسم العميل",
      date: "التاريخ",
      cashNumber: "رقم النقد",
      currencyShort: "العملة",
      exchangeRateShort: "سعر الصرف",
      amountEx: "المبلغ المحوّل",
      refInvoice: "مرجع الفاتورة",
      jvNumber: "رقم القيد",
      paymentType: "نوع الدفع",
      comments: "ملاحظات",
      rct: "إيصال",
    },
    errors: {
      selectRowToEdit: "الرجاء اختيار سطر للتعديل.",
      selectRowToDelete: "الرجاء اختيار سطر للحذف.",
      deleteFailed: "فشل الحذف.",
      selectRowToOpenStatement: "الرجاء اختيار سطر لفتح كشف الحساب.",
      selectedRowNoCustomerId: "السطر المحدد لا يحتوي على رقم عميل.",
      selectReceiptEntryFirst: "الرجاء اختيار قيد أولاً.",
      selectedEntryNoId: "القيد المحدد لا يحتوي على رقم.",
      failedFetchJournalVoucher: "فشل جلب قيد اليومية. حاول مرة أخرى.",
      noPermissionCreate: "لا يوجد صلاحية: recievables.create",
      failedLoadData: "فشل تحميل البيانات",
    },
  },
},


customersPage: {
  title: "إنشاء وعرض العملاء",
  createTitle: "إنشاء عميل",
  editTitleWithId: "تعديل العميل رقم #{id}",
  previewTitle: "عرض العملاء",
  form: {
    customerName: "اسم العميل",
    phoneNumber: "رقم الهاتف",
    financialAccount: "الحساب المالي",
    invoiceType: "نوع الفاتورة",
    selectType: "اختر النوع",
    both: "كلاهما",
    firstName: "الاسم",
    middleName: "اسم الأب",
    lastName: "الكنية",
    paymentTerms: "شروط الدفع",
    paymentTermsPlaceholder: "مثال: Net 30",
    vat: "الضريبة",
    selectVat: "اختر الضريبة",
    currency: "العملة",
    selectCurrency: "اختر العملة",
    area: "المنطقة",
    areaPlaceholder: "مثال: بيروت",
    companyType: "نوع الشركة",
    companyTypePlaceholder: "مثال: مقاول / بيع بالتجزئة",
    address: "العنوان",
    location: "الموقع",
  },
  table: {
    actions: "إجراءات",
    customerAccount: "رقم حساب العميل",
    customerName: "اسم العميل",
    first: "الاسم",
    middle: "الأب",
    last: "الكنية",
    paymentTerms: "شروط الدفع",
    area: "المنطقة",
    companyType: "نوع الشركة",
    phone: "الهاتف",
    financial: "الرقم المالي",
    invoiceType: "نوع الفاتورة",
    vat: "الضريبة",
    currency: "العملة",
    address: "العنوان",
    location: "الموقع",
    doubleClickToEdit: "اضغط مرتين للتعديل",
    noCustomersLoaded: "لم يتم تحميل أي عملاء بعد",
  },
  buttons: {
    addCustomer: "إضافة عميل",
    updateCustomer: "تعديل العميل",
    cancelEdit: "إلغاء التعديل",
    edit: "تعديل",
    loadMore: "تحميل المزيد",
  },
  messages: {
    failedLoadCustomers: "فشل تحميل العملاء",
    customerNameRequired: "اسم العميل مطلوب.",
    currencyRequired: "العملة مطلوبة.",
    customerAdded: "تمت إضافة العميل بنجاح",
    customerUpdated: "تم تعديل العميل بنجاح",
    failedAddCustomer: "فشل إضافة العميل",
    failedUpdateCustomer: "فشل تعديل العميل",
    noMoreCustomers: "لا يوجد المزيد من العملاء للتحميل",
  },
},


suppliersPage: {
  title: "إنشاء وعرض الموردين",
  previewTitle: "عرض الموردين",
  form: {
    supplierName: "اسم المورد",
    phoneNumber: "رقم الهاتف",
    financialAccount: "الحساب المالي",
    invoiceType: "نوع الفاتورة",
    selectType: "اختر النوع",
    vat: "الضريبة",
    selectVat: "اختر الضريبة",
    currency: "العملة",
    selectCurrency: "اختر العملة",
    address: "العنوان",
    location: "الموقع",
  },
  table: {
    supplierAccountNumber: "رقم حساب المورد",
    supplierName: "اسم المورد",
    phoneNumber: "رقم الهاتف",
    financialAccount: "الحساب المالي",
    invoiceType: "نوع الفاتورة",
    vat: "الضريبة",
    currency: "العملة",
    address: "العنوان",
    location: "الموقع",
  },
  buttons: {
    addSupplier: "إضافة مورد",
    loadMore: "تحميل المزيد",
  },
  messages: {
    supplierAdded: "تمت إضافة المورد بنجاح",
    failedAddSupplier: "فشل إضافة المورد",
    noMoreSuppliers: "لا يوجد المزيد من الموردين للتحميل",
  },
},


  // Common (cleaned ✅ — no duplicate loading)
  common: {
    save: "حفظ",
    cancel: "إلغاء",
    delete: "حذف",
    edit: "تعديل",
    add: "إضافة",
    search: "بحث",
    clear: "مسح",
    submit: "إرسال",
    close: "إغلاق",
    confirm: "تأكيد",
    loading: "جاري التحميل...",
    saving: "جاري الحفظ...",
    processing: "جاري المعالجة...",
    noData: "لا توجد بيانات",
    error: "خطأ",
    success: "نجح",
    select: "اختر",
    yes: "نعم",
    no: "لا",
    ok: "موافق",

  },
};
