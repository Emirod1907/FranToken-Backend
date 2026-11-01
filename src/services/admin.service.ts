import { getAddress } from "ethers";
import { Project } from "../models/project.model";
import { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";

export async function setUserKyc(userId: string, approved: boolean) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound("Usuario no encontrado.");
  user.kycApproved = approved;
  await user.save();
  return { userId: user.id, kycApproved: user.kycApproved };
}

type ProjectPatch = {
  status?: "publicada" | "en_operacion" | "cerrada";
  unitPriceMinor?: string;
  tokenSymbol?: string;
  tokenAddress?: string;
  investmentAgreementAddress?: string;
  totalUnits?: string;
};

export async function updateProject(slug: string, patch: ProjectPatch) {
  const project = await Project.findByPk(slug);
  if (!project) throw ApiError.notFound("Proyecto no encontrado.");

  if (patch.status !== undefined) project.status = patch.status;
  if (patch.unitPriceMinor !== undefined) project.unitPriceMinor = patch.unitPriceMinor;
  if (patch.tokenSymbol !== undefined) project.tokenSymbol = patch.tokenSymbol;
  if (patch.totalUnits !== undefined) project.totalUnits = patch.totalUnits;
  // Direcciones EVM: normaliza a checksum.
  if (patch.tokenAddress !== undefined) {
    project.tokenAddress = getAddress(patch.tokenAddress);
  }
  if (patch.investmentAgreementAddress !== undefined) {
    project.investmentAgreementAddress = getAddress(patch.investmentAgreementAddress);
  }

  await project.save();
  return project.toContract();
}
