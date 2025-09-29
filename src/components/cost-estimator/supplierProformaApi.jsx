import axios from "axios";
const baseUrl = process.env.REACT_APP_API_BASE_URL;

const API_URL = `${baseUrl}/supplier-proformas`;

export const createSupplierProforma = async (proformaData) => {
  const response = await axios.post(API_URL, proformaData);
  return response.data;
};

export const getAllSupplierProformas = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};
