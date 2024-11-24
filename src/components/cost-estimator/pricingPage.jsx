import React, { useState, useEffect } from "react";
import "./pricingPage.css";
import "./styles/CostTable.css";

import SupplierDetails from "./SupplierDetails";
import ItemDetails from "./ItemDetails";
import InvoiceDetails from "./invoiceDetails";
import FeesAndTaxes from "./FeesAndTaxes";
import CostTable from "./CostTable";
import {
  createSupplierProforma,
  getAllSupplierProformas,
} from "./supplierProformaApi";

const PricingPage = () => {
  const [supplierName, setSupplierName] = useState("");

  const [selectedItems, setSelectedItems] = useState([
    { itemName: "", length: "", width: "", fobPrice: "", numContainers: "" },
  ]);
  const [supplierId, setSupplierId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [customs, setCustoms] = useState("");
  const [tva, setTva] = useState("");
  const [fio, setFio] = useState("");
  const [fioTva, setFioTva] = useState("");
  const [transport, setTransport] = useState("");
  const [transportTva, setTransportTva] = useState("");
  const [transferFees, setTransferFees] = useState("");
  const [savedProformas, setSavedProformas] = useState([]);

  const totalFobPrice = selectedItems.reduce(
    (sum, item) => sum + parseFloat(item.fobPrice || 0),
    0
  );
  const totalInvoiceAmount =
    parseFloat(invoiceAmount || 0) + parseFloat(shippingCost || 0);
  const totalFees =
    parseFloat(customs || 0) +
    parseFloat(fio || 0) +
    parseFloat(transport || 0) +
    parseFloat(transferFees || 0);
  const totalTva =
    parseFloat(tva || 0) +
    parseFloat(fioTva || 0) +
    parseFloat(transportTva || 0);

  const resetAllFields = () => {
    setSupplierName("");
    setSupplierId(null);
    setInvoiceAmount("");
    setShippingCost("");
    setCustoms("");
    setTva("");
    setFio("");
    setFioTva("");
    setTransport("");
    setTransportTva("");
    setTransferFees("");
    setSelectedItems([
      { itemName: "", length: "", width: "", fobPrice: "", numContainers: "" },
    ]);
  };
  const deleteRow = (index) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };
  const handleSubmitProforma = async () => {
    if (!supplierId) {
      alert("Please select a valid supplier.");
      return;
    }

    const proformaPayload = {
      supplier: supplierId, // Send the supplier ID
      date: new Date().toISOString().split("T")[0],
      invoiceAmount: parseFloat(invoiceAmount),
      shippingCost: parseFloat(shippingCost),
      totalInvoiceAmount,
      customs: parseFloat(customs),
      tva: parseFloat(tva),
      fio: parseFloat(fio),
      fioTva: parseFloat(fioTva),
      transport: parseFloat(transport),
      transportTva: parseFloat(transportTva),
      transferFees: parseFloat(transferFees),
      totalFees,
      totalTva,
      items: selectedItems.map((item) => ({
        itemName: item.itemName,
        length: item.length,
        width: item.width,
        fobPrice: parseFloat(item.fobPrice || 0),
        containersNumber: parseInt(item.numContainers || 0, 10),
        cfrPrice: parseFloat(item.cfrPrice || 0),
        finalCost: parseFloat(item.finalCost || 0),
        //costPercentage: parseFloat(costPercentage || 0),
      })),
    };

    try {
      const savedProforma = await createSupplierProforma(proformaPayload);
      setSavedProformas((prev) => [...prev, savedProforma]);
      console.log("Proforma saved successfully:", savedProforma);
      resetAllFields();
    } catch (error) {
      console.error("Error saving proforma:", error);
    }
  };

  useEffect(() => {
    const fetchProformas = async () => {
      try {
        const data = await getAllSupplierProformas();
        setSavedProformas(data);
      } catch (error) {
        console.error("Error fetching proformas:", error);
      }
    };

    fetchProformas();
  }, []);

  return (
    <div className="pricing-page">
      <div className="container-wrapper">
        <div className="pricing-container">
          <SupplierDetails
            supplierName={supplierName}
            setSupplierName={setSupplierName}
            setSupplierId={setSupplierId}
            resetAllFields={resetAllFields}
            handleSave={handleSubmitProforma}
          />
          <ItemDetails
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedRowIndex={selectedRowIndex}
            setSelectedRowIndex={setSelectedRowIndex}
            deleteRow={deleteRow}
          />
          <InvoiceDetails
            invoiceAmount={invoiceAmount}
            setInvoiceAmount={setInvoiceAmount}
            shippingCost={shippingCost}
            setShippingCost={setShippingCost}
            totalInvoiceAmount={totalInvoiceAmount}
          />
          <FeesAndTaxes
            customs={customs}
            setCustoms={setCustoms}
            tva={tva}
            setTva={setTva}
            fio={fio}
            setFio={setFio}
            fioTva={fioTva}
            setFioTva={setFioTva}
            transport={transport}
            setTransport={setTransport}
            transportTva={transportTva}
            setTransportTva={setTransportTva}
            transferFees={transferFees}
            setTransferFees={setTransferFees}
            totalFees={totalFees || 0}
            totalTva={totalTva || 0}
          />
        </div>
        <CostTable
          selectedItems={selectedItems}
          shippingCost={shippingCost}
          totalInvoiceAmount={totalInvoiceAmount}
          totalFees={totalFees}
          invoiceAmount={invoiceAmount}
        />

        <div className="saved-proformas">
          <h2>Saved Proformas</h2>
          <ul>
            {savedProformas.map((proforma) => (
              <li key={proforma.id}>
                {proforma.proformaNumber} - {proforma.itemName}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
