// src/translations/en.js
export const en = {
  // Year Settings Page
  yearSettings: {
    title: "Fiscal Year Settings",
    currentActiveYear: "Current Active Year",
    noActiveYear: "No active fiscal year is set.",
    addNewYear: "Add New Year",
    yearLabel: "Year:",
    yearPlaceholder: "Example: 2025 or 25",
    addYearButton: "Add Year",
    setActiveYear: "Set Active Year",
    yearToActivateLabel: "Year to set as active:",
    yearToActivatePlaceholder: "Enter an existing year",
    setAsActiveButton: "Set as Active",
    saving: "Saving...",
    yearAddedSuccess: "Year {year} was added successfully.",
    activeYearSetSuccess: "Active fiscal year set to {year}.",
    enterYearError: "Please enter the year you want to add.",
    enterActiveYearError: "Please enter the year you want to set as active.",
    loadError: "Failed to load active fiscal year.",
    addError: "Error occurred while adding the year.",
    setActiveError: "Error occurred while setting active year.",
  },

  // Language Settings
  languageSettings: {
    title: "Language Settings",
    currentLanguage: "Current Language",
    selectLanguage: "Select Language",
    english: "English",
    arabic: "Arabic",
    changeLanguage: "Change Language",
  },

  // Inventory Table
  inventoryTable: {
    // Headers
    rtn: "RTN",
    rtnQty: "RTN Qty",
    origin: "Origin",
    condition: "Condition",
    item: "Item",
    type: "Type",
    length: "Length",
    width: "Width",
    box: "Box",
    sheet: "Sheet",
    price: "Price",
    sqm: "SQM",
    total: "Total",

    // Placeholders
    lengthPlaceholder: "Length",
    widthPlaceholder: "Width",
    enterBoxes: "Enter boxes…",
    sheetsPerBox: "Sheets/box…",
    enterQty: "Enter qty…",
    enterSheets: "Enter sheets…",

    // Messages
    noItems: 'No items selected. Click "Search" to add item batches.',
  },

  // Customer Details (legacy keys you already used)
  customerDetails: {
    companyName: "Company Name",
    customerName: "Customer Name",
    searchCustomer: "Search Customer Name",
    searchItems: "Search Items",
    cut: "Cut",
    cutOn: "Cut (ON)",
    getPrice: "Get Price",
    viewHistory: "View History",
  },

  // Stock Tab / Search Modal
  stockTab: {
    // Headers
    select: "SELECT",
    item: "ITEM",
    type: "TYPE",
    length: "LENGTH",
    stockBox: "STOCK BOX",
    stockSheet: "STOCK SHEET",
    stock: "STOCK",
    origin: "ORIGIN",
    condition: "CONDITION",
    dateReceived: "DATE RECEIVED",

    // Buttons & Labels
    clear: "Clear",
    selected: "Selected",
    allOrigins: "All Origins",
    allTypes: "All Types",
    loadMore: "Load more",
    loading: "Loading...",
    noMoreItems: "No more items",
    noData: "No Data",
    page: "Page",
    showing: "Showing",
    rows: "rows",

    // Repeat Modal
    sqmRepetitions: "SQM repetitions",
    howManyTimes: "How many times do you want to add it?",
    cancel: "Cancel",
    ok: "OK",

    // Search Placeholder
    searchPlaceholder:
      "اكتب ثم Enter — مثال: 5.5ملم ابيض  |  225*321-012  |  225 321",
  },

  // Search Modal (your SearchModal.jsx)
  searchModal: {
    title: "Search",
    tabsAriaLabel: "Search Results Tabs",
    okWithCount: "OK ({count})",
    noPermissionsError: "ERROR!. Please Contact the Administrator.",
    tabs: {
      stock: "Stock Items",
      all: "All",
      sqm: "SQM Pieces",
      media: "Pictured Items",
    },
  },

  // POS Toolbar (Toolbar.jsx)
  posToolbar: {
    new: "New",
    editInvoice: "Edit Invoice",
    request: "Request",
    editRequest: "Edit Request",
    issue: "Issue",
    offer: "Offer",
    rvr: "RVR",
    rvrTitle: "RVR",
    rrvr: "RRVR",
    rrvrTitle: "RRVR",
    freeReturn: "Free Return",
    freeReturnTitle: "Create a free-form return (not linked to a specific invoice)",
    freeReturnChooseType: "Select the base type for this return:",
    freeReturnTypeS: "S — Sales",
    freeReturnTypeG: "G — Offer",
    freeReturnCancel: "Cancel",

    saveRequest: "Save Request",
    saveInvoice: "Save Invoice",

    return: "Return",
    returnSelectedWithCount: "Return Selected ({count})",
    cancelReturn: "Cancel Return",

    returnNotAvailable: "Return is not available for this invoice",
    finishEditingBeforeReturning: "Finish editing before returning",
    selectItemsToReturn: "Select items to return",
    createReturnFromSelectedTitle: "Create return invoice from selected rows",
    cancelReturnSelectionTitle: "Cancel return selection",

    viewInvoice: "View Invoice",
    viewRequest: "View Req",

    deliveryNoteShort: "Del Note",
    deliveryNoteForRequest: "Delivery Note for Request",
    deliveryNoteForInvoice: "Delivery Note for Invoice",
    selectRequestOrInvoiceFirst: "Select a request or invoice first",

    statementShort: "Stmt",
    statementTitle: "Statement",
    openStatementAria: "Open Statement",
  },

  // POS CustomerDetails (CustomerDetails.jsx extra titles)
  posCustomerDetails: {
    clickEditFirst: "Click Edit first",
    currency: "Currency",
    viewHistoryTitle: "View Customer Price History",
  },

  // Dashboard
  dashboard: {
    title: "Business Hub",
    subtitle: "Navigate through modules to manage your operations effectively",
    sections: {
      posSystem: "POS System",
      recievables: "Recivables",
      rvrRecievables: "RVR Receivables",
      warehouseStock: "Warehouse Stock",
      zeroVatInvoices: "0% VAT Invoices",
      shipmentTracking: "Shipment Tracking",
      inventory: "Inventory",
      customers: "Customers",
      purchasesInvoice: "Purchases Invoice",
      settings: "Settings",
      suppliers: "Suppliers",
      items: "Items",
      costEstimator: "Cost Estimator",
      accounts: "Accounts",
      payments: "Payments",
      transactions: "Transactions",
      inventoryActivity: "Inventory Activity",
      reports: "Reports",
      sqm: "SQM",
      cutsControl: "Cuts Control",
      viewing: "Viewing",
      cashCollections: "Cash Collections",
      employeeFiles: "Employee Files",
      activityMonitor: "Activity Monitor",
      users: "Users",
      faceEnroll: "Face Login Enrollment",
      recording: "Recording Control",
      rvrRandomizer: "RVR Bulk Randomizer",
      invoiceTypeConverter: "Invoice Type Converter",
      receivableTypeConverter: "Receivable Type Converter",
      receivableSequenceAudit: "Receivable Sequence Audit",
    },
  },

  // Receivables (merged ✅ — no duplicate key now)
  receivables: {
    // NewRecordModal
    newRecord: {
      title: "New Record",
      addRow: "Add Row",
      addAtLeastOneRowTitle: "Add at least one row",
      pickCustomerTitle: "Click to select customer",
      headers: {
        customerName: "Customer Name",
        type: "Type",
        paymentType: "Pmt Type",
        currency: "Currency",
        cashNumber: "Cash Number",
        exchangeRate: "Exchange Rate",
        amountEx: "Amount Ex",
        date: "Date",
        invoiceNumber: "Invoice #",
        comments: "Comments",
      },
    },

    invoiceTitleWithNumber: "Invoice {number}",

    invoicePicker: {
      invoiceNumber: "Invoice #",
      date: "Date",
      noVat: "No VAT",
      vat: "VAT",
      total: "Total",
      none: "— None —",
      loadingInvoices: "Loading invoices...",
      noInvoicesForCustomer: "No invoices for this customer.",
      loadMore: "Load more",
      loadingMore: "Loading...",
    },

    types: { G: "G", S: "S", RVR: "RVR" },

    paymentTypes: {
      cash: "Cash",
      check: "Check",
    },

    errors: {
      failedLoadInvoices: "Failed to load invoices for this customer.",
      addAtLeastOneRow: "Add at least one row.",
      rowCustomerRequired: "Row {row}: Customer is required.",
      rowTypeRequired: "Row {row}: JV Type is required.",
      rowPaymentTypeRequired: "Row {row}: Payment Type is required.",
      rowCurrencyRequired: "Row {row}: Currency is required.",
      rowCashNumberRequired: "Row {row}: Cash number is required.",
      rowExchangeRateRequiredForLL: "Row {row}: Exchange rate is required for LL.",
      rowAmountExchangedRequired: "Row {row}: Amount exchanged is required.",
      rowDateRequired: "Row {row}: Date is required.",
      failedMarkCashCollections:
        "Receivable saved but failed to mark CashCollections (ids={count}).",
    },

    messages: {
      savedSuccessfully: "Saved successfully!",
    },

    // AccountingPage
    page: {
      searchPlaceholder: "Search by Customer or JV#",
      buttons: {
        new: "New",
        statementShort: "Stmt",
        viewJv: "View JV",
        dailyReport: "Daily Report",
        receipt: "Receipt",
      },
      titles: {
        selectRowFirst: "Select a row first",
        openStatementForSelectedCustomer: "Open statement for selected customer",
        selectReceiptEntryFirst: "Select a receipt entry first",
        viewJournalVoucherForSelectedEntry:
          "View journal voucher for selected entry",
        viewDailyReceivables: "View daily receivables report",
      },
      loadingData: "Loading data...",
      searching: "Searching…",
      confirmDeleteMessage: "Are you sure you want to delete this entry?",
      table: {
        selectRowAria: "Select row",
        customerName: "Customer Name",
        date: "Date",
        cashNumber: "Cash Number",
        currencyShort: "Cur",
        exchangeRateShort: "Ex Rate",
        amountEx: "Amount Ex",
        refInvoice: "Ref Invoice",
        jvNumber: "JV Number",
        paymentType: "PMT Type",
        comments: "Comments",
        rct: "RCT",
      },
      errors: {
        selectRowToEdit: "Please select a row to edit.",
        selectRowToDelete: "Please select a row to delete.",
        deleteFailed: "Delete failed.",
        selectRowToOpenStatement: "Please select a row to open statement.",
        selectedRowNoCustomerId: "Selected row has no customer id.",
        selectReceiptEntryFirst: "Please select a receipt entry first.",
        selectedEntryNoId: "Selected entry has no ID.",
        failedFetchJournalVoucher:
          "Failed to fetch journal voucher. Please try again.",
        noPermissionCreate: "No permission: recievables.create",
        failedLoadData: "Failed to load data",
      },
      messages: {
        deletedSuccessfully: "Deleted successfully.",
        noJournalVoucherFound:
          "No journal voucher found for this receipt entry.",

      },
    },
  },


  customersPage: {
  title: "Create and Preview Customers",
  createTitle: "Create Customer",
  editTitleWithId: "Edit Customer #{id}",
  previewTitle: "Customer Preview",
  form: {
    customerName: "Customer Name",
    phoneNumber: "Phone Number",
    financialAccount: "Financial Account",
    invoiceType: "Invoice Type",
    selectType: "Select Type",
    both: "Both",
    firstName: "First Name",
    middleName: "Middle Name",
    lastName: "Last Name",
    paymentTerms: "Payment Terms",
    paymentTermsPlaceholder: "e.g. Net 30",
    vat: "VAT",
    selectVat: "Select VAT",
    currency: "Currency",
    selectCurrency: "Select Currency",
    area: "Area",
    areaPlaceholder: "e.g. Beirut",
    companyType: "Company Type",
    companyTypePlaceholder: "e.g. Contractor / Retail",
    address: "Address",
    location: "Location",
  },
  table: {
    actions: "Actions",
    customerAccount: "Customer Account #",
    customerName: "Customer Name",
    first: "First",
    middle: "Middle",
    last: "Last",
    paymentTerms: "Payment Terms",
    area: "Area",
    companyType: "Company Type",
    phone: "Phone",
    financial: "Financial #",
    invoiceType: "Invoice Type",
    vat: "VAT",
    currency: "Currency",
    address: "Address",
    location: "Location",
    doubleClickToEdit: "Double click to edit",
    noCustomersLoaded: "No customers loaded yet",
  },
  buttons: {
    addCustomer: "Add Customer",
    updateCustomer: "Update Customer",
    cancelEdit: "Cancel Edit",
    edit: "Edit",
    loadMore: "Load More",
  },
  messages: {
    failedLoadCustomers: "Failed to load customers",
    customerNameRequired: "Customer Name is required.",
    currencyRequired: "Currency is required.",
    customerAdded: "Customer Added Successfully",
    customerUpdated: "Customer Updated Successfully",
    failedAddCustomer: "Failed to Add Customer",
    failedUpdateCustomer: "Failed to Update Customer",
    noMoreCustomers: "No more customers to load",
  },
},


suppliersPage: {
  title: "Create and Preview Suppliers",
  previewTitle: "Supplier Preview",
  form: {
    supplierName: "Supplier Name",
    phoneNumber: "Phone Number",
    financialAccount: "Financial Account",
    invoiceType: "Invoice Type",
    selectType: "Select Type",
    vat: "VAT",
    selectVat: "Select VAT",
    currency: "Currency",
    selectCurrency: "Select Currency",
    address: "Address",
    location: "Location",
  },
  table: {
    supplierAccountNumber: "Supplier Account Number",
    supplierName: "Supplier Name",
    phoneNumber: "Phone Number",
    financialAccount: "Financial Account",
    invoiceType: "Invoice Type",
    vat: "VAT",
    currency: "Currency",
    address: "Address",
    location: "Location",
  },
  buttons: {
    addSupplier: "Add Supplier",
    loadMore: "Load More",
  },
  messages: {
    supplierAdded: "Supplier Added Successfully",
    failedAddSupplier: "Failed to Add Supplier",
    noMoreSuppliers: "No more suppliers to load",
  },
},


  // Common
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    search: "Search",
    clear: "Clear",
    submit: "Submit",
    close: "Close",
    confirm: "Confirm",
    loading: "Loading...",
    saving: "Saving...",
    processing: "Processing...",
    noData: "No data available",
    error: "Error",
    success: "Success",
    select: "Select",
    yes: "Yes",
    no: "No",
    ok: "OK",

  },
};
