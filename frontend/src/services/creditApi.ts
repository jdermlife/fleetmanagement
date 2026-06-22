import { api } from "../api/api";

export const CreditApi = {

  async computeScore(data: any) {
    const borrowers = Array.isArray(data?.borrowers) ? data.borrowers : [];
    const properties = Array.isArray(data?.properties) ? data.properties : [];

    const borrowerCount = Math.max(borrowers.length, 1);
    const avgDsr = borrowers.reduce((acc: number, item: any) => acc + (Number(item?.dsr_percent) || 0), 0) / borrowerCount;
    const avgAddressYears =
      borrowers.reduce((acc: number, item: any) => acc + (Number(item?.address_stay_years) || 0), 0) / borrowerCount;
    const avgNetIncome =
      borrowers.reduce((acc: number, item: any) => acc + (Number(item?.net_disposable_income) || 0), 0) / borrowerCount;
    const totalCollateral = properties.reduce(
      (acc: number, item: any) => acc + (Number(item?.appraised_value) || 0),
      0,
    );

    const capacityScore = Math.max(5, Math.min(25, 25 - avgDsr / 4));
    const characterScore = Math.max(5, Math.min(25, 8 + avgAddressYears * 2));
    const collateralScore = Math.max(5, Math.min(25, totalCollateral > 0 ? 20 : 10));
    const conditionScore = Math.max(5, Math.min(25, avgNetIncome > 50000 ? 22 : avgNetIncome > 20000 ? 16 : 10));

    const totalScore = Math.round(capacityScore + characterScore + collateralScore + conditionScore);
    const riskClassification = totalScore >= 85 ? "A" : totalScore >= 70 ? "B" : totalScore >= 55 ? "C" : "D";

    return {
      capacity_score: Number(capacityScore.toFixed(2)),
      character_score: Number(characterScore.toFixed(2)),
      collateral_score: Number(collateralScore.toFixed(2)),
      condition_score: Number(conditionScore.toFixed(2)),
      total_score: totalScore,
      risk_classification: riskClassification,
    };
  },

  async calculateCreditScore(data: any) {
    return this.computeScore(data);
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