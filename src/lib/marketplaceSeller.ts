// The checks on a MarketPortal seller's details (a company an admin sets up, or a customer selling their
// own items), shared by /api/admin/marketplace/companies and /api/marketplace/sell/seller.
import { SA_BANKS } from "@/lib/marketplace"

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface SellerDetails {
  name: string
  contactName: string
  contactEmail: string
  phone: string
  address: string
  area: string
  lat: number
  lng: number
  bank: { accountHolder: string; bankId: string; accountNumber: string; accountType: "savings" | "cheque"; branchCode: string }
  loginEmails: string[]
}

export function parseSellerInput(b: any, opts: { requireTerms: boolean }): { error: string } | { data: SellerDetails } {
  const bank = b?.bank ?? {}
  const loginEmails: string[] = Array.from(
    new Set((Array.isArray(b?.loginEmails) ? b.loginEmails : []).map((e: unknown) => str(e).toLowerCase()).filter(Boolean))
  )
  const lat = Number(b?.lat)
  const lng = Number(b?.lng)
  const bankInfo = SA_BANKS.find((x) => x.id === bank.bankId)

  const error =
    !str(b?.name) ? "Seller name is required."
    : !str(b?.contactName) ? "Contact person is required."
    : str(b?.phone).replace(/\D/g, "").length < 9 ? "A valid phone number is required."
    : !str(b?.address) || !Number.isFinite(lat) || !Number.isFinite(lng) ? "Choose the pickup address from the suggestions."
    : !str(bank.accountHolder) || !bankInfo || !/^\d{6,16}$/.test(str(bank.accountNumber)) ? "Complete the bank details (account number 6 to 16 digits)."
    : loginEmails.some((e) => !EMAIL.test(e)) ? "One of the login emails is not valid."
    : opts.requireTerms && b?.termsAccepted !== true ? "Accept the Seller Terms and Conditions to continue."
    : ""
  if (error) return { error }

  return {
    data: {
      name: str(b.name),
      contactName: str(b.contactName),
      contactEmail: str(b.contactEmail).toLowerCase(),
      phone: str(b.phone),
      address: str(b.address),
      area: str(b.area) || str(b.address),
      lat,
      lng,
      bank: {
        accountHolder: str(bank.accountHolder),
        bankId: bankInfo!.id,
        accountNumber: str(bank.accountNumber),
        accountType: bank.accountType === "cheque" ? "cheque" : "savings",
        branchCode: bankInfo!.branchCode,
      },
      loginEmails,
    },
  }
}

// A customer's own seller account has a fixed id, so each login has at most one.
export const customerSellerId = (uid: string) => `seller-${uid}`
