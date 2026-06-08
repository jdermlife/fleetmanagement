import { api } from "../api/api";

export const CreditApi = {

  async computeScore(data: any) {
    const response = await api.post("/credit-score", data);
    return response.data;
  },

  async calculateCreditScore(data: any) {
    const response = await api.post("/credit-score", data);
    return response.data;
  },

  async getDrivers() {
    const response = await api.get("/drivers");
    return response.data;
  },

  async createDriver(data: any) {
    const response = await api.post("/drivers", data);
    return response.data;
  }

};