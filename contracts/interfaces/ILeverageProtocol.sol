// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ILeverageProtocol
 * @notice Universal atomic-leverage interface for lending plugins that support it.
 * @dev Separata da IProtocolAdapter perché non tutti i lender supportano leva atomica
 *      (i plugin supply-only — MorphoVault, InterVault — NON la implementano).
 *
 *      Convenzione pair-based (collateral, loan) coerente con IProtocolAdapter v2:
 *      - `collateral` = token code del collaterale della posizione
 *      - `loan`       = token code dell'asset preso in prestito
 *
 *      Sostituisce i 3 struct locali divergenti definiti oggi dentro
 *      AaveV3Plugin / EulerV2Plugin / MorphoPlugin (OpenLeverageAtomicParams /
 *      CloseLeverageAtomicParams) con UN unico tipo condiviso.
 *
 *      Riferimenti: DEC-006 (pair-based), DEC-009 (target IProtocolAdapter),
 *      C1-06 (slippage end-to-end: minCollateralAfterSwap + maxSlippageBps).
 */
interface ILeverageProtocol {
    /**
     * @notice Parametri per aprire una posizione a leva in modo atomico (flash loan).
     * @param collateral            token code del collaterale
     * @param loan                  token code dell'asset preso in prestito
     * @param collateralAmount      collaterale iniziale fornito dal vault
     * @param targetLeverageX100    leva obiettivo *100 (es. 200 = 2x)
     * @param minCollateralAfterSwap minimo collaterale accettato dopo lo swap (anti-sandwich, SWP-001/C1-06)
     * @param minHealthFactor       health factor minimo richiesto a fine apertura, in scala WAD (1e18 = 1.0)
     * @param maxSlippageBps        slippage massimo tollerato nei callback, in basis points (enforced, C1-06)
     * @param deadline              timestamp unix massimo per l'esecuzione
     */
    struct OpenLeverageParams {
        string collateral;
        string loan;
        uint256 collateralAmount;
        uint256 targetLeverageX100;
        uint256 minCollateralAfterSwap;
        uint256 minHealthFactor;
        uint256 maxSlippageBps;
        uint256 deadline;
    }

    /**
     * @notice Parametri per chiudere una posizione a leva in modo atomico.
     * @param collateral      token code del collaterale
     * @param loan            token code dell'asset preso in prestito
     * @param minCollateralOut minimo collaterale restituito accettato (anti-sandwich)
     * @param maxSlippageBps  slippage massimo tollerato nei callback, in basis points
     * @param deadline        timestamp unix massimo per l'esecuzione
     */
    struct CloseLeverageParams {
        string collateral;
        string loan;
        uint256 minCollateralOut;
        uint256 maxSlippageBps;
        uint256 deadline;
    }

    /**
     * @notice Apre una posizione a leva atomica. I fondi risultanti restano in custody (ProxyGeneral).
     * @return totalCollateral collaterale totale della posizione dopo l'apertura
     * @return totalDebt       debito totale della posizione dopo l'apertura
     * @return healthFactor    health factor risultante, in scala WAD
     */
    function openLeverageAtomic(OpenLeverageParams calldata params)
        external
        returns (uint256 totalCollateral, uint256 totalDebt, uint256 healthFactor);

    /**
     * @notice Chiude una posizione a leva atomica, riportando il collaterale a base asset in custody.
     * @return collateralReturned collaterale (in base asset) restituito a ProxyGeneral
     */
    function closeLeverageAtomic(CloseLeverageParams calldata params)
        external
        returns (uint256 collateralReturned);
}
