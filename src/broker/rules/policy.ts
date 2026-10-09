import type { Policy } from "../contracts";

const OLM = "https://mdhhs-pres-prod.michigan.gov/olmweb/EX";

export const BEM_213: Policy = {
  manual: "BEM",
  item: "213",
  title: "Categorical Eligibility",
  effective: "2026-02-01",
  url: `${OLM}/BP/Public/BEM/213.pdf`,
};

export const BEM_556: Policy = {
  manual: "BEM",
  item: "556",
  title: "Computing the Food Assistance Budget",
  effective: "2025-11-01",
  url: `${OLM}/BP/Public/BEM/556.pdf`,
};

export const BEM_137: Policy = {
  manual: "BEM",
  item: "137",
  title: "Healthy Michigan Plan",
  effective: "2024-01-01",
  url: `${OLM}/BP/Public/BEM/137.pdf`,
};

export const RFT_250: Policy = {
  manual: "RFT",
  item: "250",
  title: "SNAP Income Limits",
  effective: "2026-10-01",
  url: `${OLM}/RF/Public/RFT/250.pdf`,
};
