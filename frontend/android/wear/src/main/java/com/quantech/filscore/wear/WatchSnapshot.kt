package com.quantech.filscore.wear

import org.json.JSONArray
import org.json.JSONObject

data class WatchSnapshot(
    val updatedAt: String? = null,
    val financialHealth: Double? = null,
    val goldRingScore: Double? = null,
    val silverRingScore: Double? = null,
    val bronzeRingScore: Double? = null,
    val financialHealthTrend: List<Double> = emptyList(),
    val creditScore: Double? = null,
    val creditFilscore: Double? = null,
    val creditBureauFilscore: Double? = null,
    val psychometricFilscore: Double? = null,
    val socialFilscore: Double? = null,
    val nonStarterFilscore: Double? = null,
    val creditHealthTrend: List<Double> = emptyList(),
    val wealthBuilding: Double? = null,
    val netWorth: Double? = null,
    val liquidityBuffer: Double? = null,
    val cashFlowStrength: Double? = null,
    val leverageControl: Double? = null,
    val emergencyReadiness: Double? = null,
    val investmentReadiness: Double? = null,
    val retirementReadiness: Double? = null,
    val financialIndependence: Double? = null,
    val goalMomentum: Double? = null,
    val protectionCoverage: Double? = null,
    val wealthBuildingTrend: List<Double> = emptyList(),
    val budgetScore: Double? = null,
    val monthlyIncome: Double? = null,
    val monthlyExpenses: Double? = null,
    val monthlyCashFlow: Double? = null,
    val budgetTrend: List<Double> = emptyList()
) {
    val resolvedGoldRingScore: Double?
        get() = goldRingScore ?: weightedScore(
            listOf(creditScore to 15.0, cashFlowStrength to 14.0, leverageControl to 14.0)
        )

    val resolvedSilverRingScore: Double?
        get() = silverRingScore ?: weightedScore(
            listOf(budgetScore to 11.0, wealthBuilding to 10.0, protectionCoverage to 10.0)
        )

    val resolvedBronzeRingScore: Double?
        get() {
            if (bronzeRingScore != null) return bronzeRingScore
            val investment = investmentReadiness ?: return null
            val retirement = retirementReadiness ?: return null
            val independence = financialIndependence ?: return null
            val goal = goalMomentum ?: return null
            val investmentScore = (investment + retirement + independence) / 3.0
            return ((investmentScore * 11.0) + (goal * 15.0)) / 26.0
        }

    private fun weightedScore(values: List<Pair<Double?, Double>>): Double? {
        if (values.any { it.first == null }) return null
        return values.sumOf { it.first!! * it.second } / values.sumOf { it.second }
    }

    companion object {
        fun fromJson(json: JSONObject): WatchSnapshot {
            val financial = json.section("financialHealth")
            val credit = json.section("creditHealth")
            val wealth = json.section("wealthBuilding")
            val netWorth = json.section("netWorth")
            val budget = json.section("budget")

            return WatchSnapshot(
                updatedAt = json.stringOrNull("updatedAt"),
                financialHealth = financial.number("value"),
                goldRingScore = json.number("goldRingScore"),
                silverRingScore = json.number("silverRingScore"),
                bronzeRingScore = json.number("bronzeRingScore"),
                financialHealthTrend = financial.numbers("trend"),
                creditScore = credit.number("creditScore"),
                creditFilscore = credit.number("creditFilscore"),
                creditBureauFilscore = credit.number("creditBureauFilscore"),
                psychometricFilscore = credit.number("psychometricFilscore"),
                socialFilscore = credit.number("socialFilscore"),
                nonStarterFilscore = credit.number("nonStarterFilscore"),
                creditHealthTrend = credit.numbers("trend"),
                wealthBuilding = wealth.number("value"),
                netWorth = netWorth.number("actual"),
                liquidityBuffer = wealth.number("liquidityBuffer"),
                cashFlowStrength = wealth.number("cashFlowStrength"),
                leverageControl = wealth.number("leverageControl"),
                emergencyReadiness = wealth.number("emergencyReadiness"),
                investmentReadiness = wealth.number("investmentReadiness"),
                retirementReadiness = wealth.number("retirementReadiness"),
                financialIndependence = wealth.number("financialIndependence"),
                goalMomentum = wealth.number("goalMomentum"),
                protectionCoverage = wealth.number("protectionCoverage"),
                wealthBuildingTrend = wealth.numbers("trend"),
                budgetScore = budget.number("score"),
                monthlyIncome = budget.number("income"),
                monthlyExpenses = budget.number("expenses"),
                monthlyCashFlow = budget.number("net"),
                budgetTrend = budget.numbers("trend")
            )
        }
    }
}

private fun JSONObject.section(key: String): JSONObject = optJSONObject(key) ?: JSONObject()

private fun JSONObject.number(key: String): Double? =
    if (has(key) && !isNull(key)) optDouble(key).takeUnless { it.isNaN() } else null

private fun JSONObject.stringOrNull(key: String): String? =
    if (has(key) && !isNull(key)) optString(key).takeIf { it.isNotBlank() } else null

private fun JSONObject.numbers(key: String): List<Double> {
    val values: JSONArray = optJSONArray(key) ?: return emptyList()
    return buildList {
        for (index in 0 until values.length()) {
            val value = values.optDouble(index, Double.NaN)
            if (!value.isNaN()) add(value)
        }
    }
}