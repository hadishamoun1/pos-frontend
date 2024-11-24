import axios from "axios";

const API_URL = "http://localhost:3000/supplier-proformas";

export const createSupplierProforma = async (proformaData) => {
  const response = await axios.post(API_URL, proformaData);
  return response.data;
};

export const getAllSupplierProformas = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};
