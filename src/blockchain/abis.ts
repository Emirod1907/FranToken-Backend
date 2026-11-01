/**
 * ABIs mínimos (formato human-readable de ethers v6) de los contratos del repo
 * `FranToken` (Hardhat / ERC-3643). Se declaran a mano para desacoplar el
 * backend del artefacto compilado: solo se exponen las funciones usadas aquí.
 * Si cambian los contratos, actualizar estas firmas.
 */

export const franchiseTokenAbi = [
  // Metadatos / estado
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function version() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function holderCount() view returns (uint256)",
  "function paused() view returns (bool)",
  "function paymentToken() view returns (address)",
  "function onchainID() view returns (address)",
  // Controlador de emisión (C4). Si != address(0), mint directo revierte.
  "function issuanceController() view returns (address)",
  "function isAgent(address) view returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function isFrozen(address) view returns (bool)",
  "function getFrozenTokens(address) view returns (uint256)",
  "function franchiseInfo() view returns (tuple(string franchiseName, string brand, string location, string legalDocumentURI, bytes32 legalDocumentHash, uint256 valuation))",
  // Reparto de ingresos
  "function totalRevenueDistributed() view returns (uint256)",
  "function accumulativeRevenueOf(address) view returns (uint256)",
  "function withdrawableRevenueOf(address) view returns (uint256)",
  "function withdrawnRevenueOf(address) view returns (uint256)",
  // Operaciones de agente / owner (escritura)
  "function mint(address to, uint256 amount)",
  "function burn(address userAddress, uint256 amount)",
  "function forcedTransfer(address from, address to, uint256 amount) returns (bool)",
  "function setAddressFrozen(address userAddress, bool freeze)",
  "function freezePartialTokens(address userAddress, uint256 amount)",
  "function unfreezePartialTokens(address userAddress, uint256 amount)",
  "function pause()",
  "function unpause()",
  "function distributeRevenue(uint256 amount, string memo)",
  // Eventos
  "event RevenueDistributed(address indexed distributor, uint256 amount, string memo)",
  "event RevenueClaimed(address indexed holder, uint256 amount)",
] as const;

export const identityRegistryAbi = [
  "function registerIdentity(address userAddress, address identity, uint16 country)",
  "function deleteIdentity(address userAddress)",
  "function updateCountry(address userAddress, uint16 country)",
  "function setKycExpiration(address userAddress, uint64 validUntil)",
  "function contains(address userAddress) view returns (bool)",
  "function isVerified(address userAddress) view returns (bool)",
  "function identity(address userAddress) view returns (address)",
  "function investorCountry(address userAddress) view returns (uint16)",
  "function kycValidUntil(address userAddress) view returns (uint64)",
  "function isAgent(address) view returns (bool)",
] as const;

export const complianceAbi = [
  "function maxHolders() view returns (uint256)",
  "function maxBalancePerInvestor() view returns (uint256)",
  "function lockupEnd() view returns (uint64)",
  "function isCountryBlocked(uint16) view returns (bool)",
  "function getTokenBound() view returns (address)",
  "function canTransfer(address from, address to, uint256 amount) view returns (bool)",
] as const;

// C4 — InvestmentAgreement: aceptación de términos + emisión tras pago conciliado.
export const investmentAgreementAbi = [
  "function unitPriceMinor() view returns (uint256)",
  "function paymentVerifier() view returns (address)",
  "function acceptedTerms(address) view returns (bool)",
  "function issuedPurchase(bytes32) view returns (bool)",
  "function usedPaymentReference(bytes32) view returns (bool)",
  "function issueAfterPayment(bytes32 purchaseId, bytes32 paymentReference, address investor, uint256 units, uint256 paidAmountMinor, bytes32 evidenceHash)",
  "event PurchaseIssued(bytes32 indexed purchaseId, address indexed investor, bytes32 indexed paymentReference, uint256 units, uint256 grossMinor, uint256 platformFeeMinor, uint256 trustNetMinor, bytes32 evidenceHash)",
] as const;

export const erc20Abi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
] as const;
