import React, { useRef } from "react";
import "./invoicePreview.css";
import html2pdf from "html2pdf.js";

const InvoicePreview = () => {

  return (
    <div className="invoice-a4-wrapper" >
    
      <div className="invoice-body">
        <div className="invoice-header">
          <div className="right-info">
            <h2 className="company-title">شركة شمعون</h2>
            <h2 className="company-subtitle">للزجاج و المرايا</h2>
            <p>الحدث/ شويفات</p>
            <div className="invoice-arabic-contact">
              <div className="invoice-arabic-line">
                <span className="invoice-arabic-label">تلفون</span>
                <span className="invoice-arabic-colon">:</span>
                <span className="invoice-arabic-value">
                  05/810888 05/814964
                </span>
              </div>
              <div className="invoice-arabic-line">
                <span className="invoice-arabic-label">خلوي/ واتساب</span>
                <span className="invoice-arabic-colon">:</span>
                <span className="invoice-arabic-value">79/100068</span>
              </div>
              <div className="invoice-arabic-line">
                <span className="invoice-arabic-label">فاكس</span>
                <span className="invoice-arabic-colon">:</span>
                <span className="invoice-arabic-value">05/814961</span>
              </div>
            </div>
          </div>
          <div className="left-info">
            <h1 className="company-title">Shamoun Company</h1>
            <h2 className="company-subtitle">For Glass & Mirrors</h2>
            <p>Chweifat - Near Spot Mall</p>
            <p>Tel: 05-810 888 ; 79-1000 68 ; Fax: 05-814 961</p>
            <p>Email: info@shamoun.com</p>
            <p>VAT Reg.No 10909-601</p>
          </div>
        </div>

        <div className="invoice-meta">
          <div className="meta-right">
            <div className="meta-line">
              <span className="meta-label">اسم الزبون</span>
              <span className="meta-colon">:</span>
              <span className="meta-value">أن جي NG ش.م.م</span>
            </div>
            <div className="meta-line">
              <span className="meta-label">العنوان</span>
              <span className="meta-colon">:</span>
              <span className="meta-value">طرابلس - الميناء</span>
            </div>
            <div className="meta-line">
              <span className="meta-label">تلفون</span>
              <span className="meta-colon">:</span>
              <span className="meta-value">06/385332</span>
            </div>
            <div className="meta-line">
              <span className="meta-label">رقم الحساب</span>
              <span className="meta-colon">:</span>
              <span className="meta-value">411104039</span>
            </div>
            <div className="meta-line">
              <span className="meta-label">الرقم الضريبي</span>
              <span className="meta-colon">:</span>
              <span className="meta-value">436736-601</span>
            </div>
          </div>
          <div className="meta-left">
            <div className="meta-line">
              <span className="meta-label">رقم الفاتورة</span>
              <span className="meta-colon">:</span>
              <span className="meta-value">24-258</span>
            </div>
            <div className="meta-line">
              <span className="meta-label">التاريخ</span>
              <span className="meta-colon">:</span>
              <span className="meta-value">01-Mar-2024</span>
            </div>
            <div className="meta-line">
              <span className="meta-label">العملة</span>
              <span className="meta-colon">:</span>
              <span className="meta-value">USD</span>
            </div>
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>المبلغ</th>
              <th>السعر</th>
              <th>مساحة</th>
              <th>عرض</th>
              <th>طول</th>
              <th>لوح</th>
              <th>صندوق</th>
              <th>الشرح</th>
              <th>الصنف</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>154.05</td>
              <td>5.75</td>
              <td>26.79</td>
              <td>366</td>
              <td>244</td>
              <td>27</td>
              <td>1</td>
              <td>ك.م.5.5 أبيض</td>
              <td>00101-055-4</td>
            </tr>
            <tr>
              <td>154.05</td>
              <td>5.75</td>
              <td>26.79</td>
              <td>366</td>
              <td>244</td>
              <td>18</td>
              <td>3</td>
              <td>ك.م.5.5 أبيض</td>
              <td>00101-055-4</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="invoice-footer">
        <div className="footer-left">
          <p className="amount-in-words">
            One Hundred Seventy Point Ninety Nine USD Only
          </p>
          <div className="footer-left-table">
            <div className="footer-left-row">
              <div className="footer-left-cell"></div>
              <div className="footer-left-cell border-left"></div>
            </div>
            <div className="footer-left-label-row">
              <span className="footer-left-label">المستلم:</span>
              <span className="footer-left-label">الإمضاء:</span>
            </div>
          </div>
          <div className="footer-left-note">
            <span className="footer-left-label">ملاحظات:</span>
          </div>
        </div>

        <div className="footer-right">
          <div className="footer-line">
            <span className="footer-label">المجموع</span>
            <span className="footer-colon">:</span>
            <input className="footer-input" value="154.050" readOnly />
          </div>
          <div className="footer-line">
            <span className="footer-label">V.A.T 11 %</span>
            <span className="footer-colon">:</span>
            <input className="footer-input" value="16.946" readOnly />
          </div>
          <div className="footer-line">
            <span className="footer-label">VAT LBP</span>
            <span className="footer-colon">:</span>
            <span className="footer-value">1,516,622.25</span>
          </div>
          <div className="footer-total-line">
            <strong>المجموع الصافي</strong>
            <span className="footer-total-amount">171.00 USD</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;
