// The MarketPortal Return, Refund and Exchange Policy, shown at /marketplace/returns. Edit the wording here
// (and update RETURNS_EFFECTIVE_DATE) when the policy changes.
import { SUPPORT_PHONE } from "@/lib/contact"

export const RETURNS_EFFECTIVE_DATE = "15 October 2026"

export type ReturnsBlock =
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "terms"; items: [term: string, text: string][] } // a list of "term: explanation" items
  | { t: "note"; label: string; text: string } // a highlighted note

export interface ReturnsSection {
  title: string
  blocks: ReturnsBlock[]
}

export const RETURNS_SECTIONS: ReturnsSection[] = [
  {
    title: "Purpose of This Policy",
    blocks: [
      {
        t: "p",
        text: "Care Runners Market Portal is committed to providing customers with a transparent and reliable online shopping experience. This policy explains the conditions under which customers may request returns, refunds, exchanges, or replacements for pre-owned and brand-new items purchased through our marketplace.",
      },
      {
        t: "p",
        text: "The policy applies to purchases made through Care Runners Market Portal, subject to applicable South African consumer protection laws.",
      },
    ],
  },
  {
    title: "Your Rights Under South African Law",
    blocks: [
      { t: "p", text: "Nothing in this policy limits these rights. Where this policy and the law differ, the law applies." },
      {
        t: "terms",
        items: [
          [
            "Cooling-off for online purchases (Electronic Communications and Transactions Act, section 44)",
            "You may cancel an online purchase within 7 days after receiving the goods, without giving a reason and without a penalty. You may be charged only the direct cost of returning the goods, and any payment will be refunded within 30 days of cancelling. This does not apply to goods excluded by section 42 of the Act, such as goods made to your specifications, clearly personalised goods, and goods that are likely to deteriorate or expire rapidly.",
          ],
          [
            "Defective goods (Consumer Protection Act, sections 55 and 56)",
            "If an item is unsafe, defective, or not reasonably suitable for its purpose, you may return it within six months of delivery, at the seller's risk and expense, and choose whether it is repaired, replaced, or refunded. If a repaired item develops the same or a further defect within three months of the repair, it must be replaced or refunded. For a pre-owned item, a defect or condition that you were specifically told about before buying, and that you accepted, does not count.",
          ],
        ],
      },
    ],
  },
  {
    title: "Return Policy for Brand-New Items",
    blocks: [
      { t: "p", text: "Brand-new items are products advertised and sold as new, unused, and in their original condition." },
      { t: "p", text: "Customers may request a return, refund, or replacement under the following circumstances:" },
      {
        t: "terms",
        items: [
          ["Damaged on arrival", "The item arrives broken, damaged, or defective."],
          ["Incorrect item delivered", "The customer receives a product different from the one ordered."],
          ["Item not as described", "The product materially differs from its listing, description, images, size, specifications, or advertised features."],
          ["Missing components", "Essential parts or accessories advertised as included are missing."],
          ["Defective product", "The item fails to function as reasonably expected, subject to applicable law and any relevant warranty."],
        ],
      },
      { t: "p", text: "Return conditions:" },
      {
        t: "p",
        text: "Where appropriate, customers should return the product with its original packaging, accessories, manuals, labels, and proof of purchase. However, the absence of original packaging will not automatically remove a customer's statutory rights.",
      },
      {
        t: "p",
        text: "For a change of mind, returns are subject to the seller's stated return policy and applicable law. Products purchased online may also be subject to the cooling-off provisions of the Consumer Protection Act, where applicable.",
      },
    ],
  },
  {
    title: "Return Policy for Pre-Owned Items",
    blocks: [
      { t: "p", text: "Pre-owned items are products that have been previously owned, used, refurbished, or resold." },
      { t: "p", text: "Because these products may show signs of previous use, customers should carefully review the listing before purchasing." },
      { t: "p", text: "Each seller should disclose, where reasonably applicable:" },
      {
        t: "ul",
        items: [
          "The condition of the item, such as excellent, good, fair, or for parts.",
          "Visible scratches, dents, stains, wear, or other defects.",
          "Known functional problems.",
          "Missing accessories or components.",
          "Relevant product age, model, or history, where known.",
          "Whether the item has been refurbished or repaired.",
        ],
      },
      { t: "p", text: "Returns may be accepted where:" },
      {
        t: "ul",
        items: [
          "The item is materially different from its description.",
          "The item has an undisclosed material defect.",
          "The item arrives damaged, subject to the circumstances and applicable law.",
          "The wrong product is delivered.",
          "The item does not meet applicable statutory quality or consumer protection requirements.",
        ],
      },
      { t: "p", text: "Normal wear and tear that was clearly disclosed in the listing will not, by itself, qualify as a reason for a return." },
      {
        t: "note",
        label: "Important",
        text: "Pre-owned items are not automatically excluded from consumer protection. A seller cannot use a “sold as is” or “no returns” statement to avoid legal obligations that apply to the transaction.",
      },
    ],
  },
  {
    title: "Items That May Not Qualify for a Voluntary Return",
    blocks: [
      {
        t: "p",
        text: "Subject to statutory rights, refunds, or remedies required by law, the following may be excluded from voluntary change-of-mind returns:",
      },
      {
        t: "ul",
        items: [
          "Items damaged through misuse, accidental damage, or improper handling after delivery.",
          "Items altered, repaired, or modified by the customer without the seller's authorisation, where the alteration caused or contributed to the problem.",
          "Items with missing parts or accessories that were supplied and subsequently lost by the customer.",
          "Personalised or custom-made products.",
          "Hygiene-sensitive or sealed products where the applicable legal requirements for exclusion are met.",
          "Perishable products or other products that are legally excluded from particular return rights.",
        ],
      },
      { t: "p", text: "These exclusions do not apply where they would unlawfully limit a customer's statutory rights." },
    ],
  },
  {
    title: "Return Request Period",
    blocks: [
      { t: "p", text: "Customers should report damaged, incorrect, or materially misdescribed products as soon as reasonably possible after delivery." },
      {
        t: "p",
        text: "For marketplace administration, Care Runners recommends that customers submit a return request within 7 calendar days of delivery, including photographs and an explanation of the issue.",
      },
      {
        t: "p",
        text: "This seven-day reporting period is an administrative guideline and does not replace, shorten, or remove any longer or different period of protection provided by applicable law, a product warranty, or the seller's obligations.",
      },
      { t: "p", text: "Where a statutory cooling-off period applies to an online transaction, customers must exercise that right within the period prescribed by law." },
    ],
  },
  {
    title: "How to Request a Return",
    blocks: [
      { t: "p", text: "Customers should follow these steps:" },
      {
        t: "ul",
        items: [
          "Log in to their Care Runners Market Portal account.",
          "Locate the relevant order.",
          "Contact the seller or submit a return request through the available marketplace support channel.",
          "Provide the order number, reason for the return, and supporting photographs or videos where relevant.",
          "Keep the product and its accessories safe until return instructions are provided.",
          "Follow the approved return and collection or delivery instructions.",
        ],
      },
      { t: "p", text: "Customers should not send products to an address that has not been confirmed by the seller or Care Runners Market Portal." },
    ],
  },
  {
    title: "Inspection and Assessment",
    blocks: [
      { t: "p", text: "The seller may inspect a returned item to verify the reported issue." },
      { t: "p", text: "The inspection must be conducted fairly and must not be used to delay or deny a valid statutory remedy." },
      {
        t: "p",
        text: "Where the issue is disputed, Care Runners Market Portal may request additional evidence from the customer and seller to help resolve the matter.",
      },
    ],
  },
  {
    title: "Refund Policy",
    blocks: [
      { t: "p", text: "Depending on the circumstances, applicable law, and the remedy available, an approved claim may result in:" },
      { t: "ul", items: ["A full refund.", "A replacement product.", "A repair.", "Another remedy agreed upon by the customer and seller, where legally permitted."] },
      {
        t: "p",
        text: "Where a refund is due, it will ordinarily be processed through the original payment method, where supported. If this is not possible, an alternative lawful method may be arranged with the customer.",
      },
      {
        t: "p",
        text: "Refund processing will begin after the return has been approved and any legally permissible verification requirements have been completed. Customers will be advised of the expected processing timeframe.",
      },
      { t: "p", text: "Care Runners Market Portal will not impose an unlawful administration fee or deduction on a refund." },
    ],
  },
  {
    title: "Return Shipping and Collection Costs",
    blocks: [
      { t: "p", text: "Responsibility for return shipping costs will depend on the reason for the return and applicable law." },
      {
        t: "terms",
        items: [
          [
            "Incorrect, defective, damaged, or materially misdescribed items",
            "The seller will generally be responsible for reasonable return or collection costs where required by law or the agreed marketplace arrangements.",
          ],
          ["Change-of-mind returns", "The customer may be responsible for return costs where permitted by law and disclosed in advance."],
          ["Delivery damage", "Customers should provide photographs of the packaging and product so the matter can be assessed promptly."],
        ],
      },
      {
        t: "p",
        text: "Care Runners delivery or collection services may be used to facilitate approved returns where available. Any collection charges must be communicated before the service is arranged.",
      },
    ],
  },
  {
    title: "Seller Responsibilities",
    blocks: [
      { t: "p", text: "All sellers using Care Runners Market Portal are expected to:" },
      {
        t: "ul",
        items: [
          "Provide accurate product descriptions and photographs.",
          "Clearly identify whether an item is brand-new or pre-owned.",
          "Disclose known defects and significant wear.",
          "Honour applicable consumer protection obligations.",
          "Respond to return requests within a reasonable time.",
          "Cooperate with Care Runners in resolving customer complaints.",
          "Issue approved refunds, replacements, repairs, or other remedies within the applicable timeframe.",
        ],
      },
      { t: "p", text: "Sellers must not advertise products as brand-new when they are used, refurbished, or previously owned." },
    ],
  },
  {
    title: "Customer Responsibilities",
    blocks: [
      { t: "p", text: "Customers are expected to:" },
      {
        t: "ul",
        items: [
          "Read product descriptions and condition notes before ordering.",
          "Provide accurate delivery information.",
          "Inspect deliveries and report issues promptly.",
          "Provide truthful information and supporting evidence when requesting a return.",
          "Package returned products appropriately to prevent additional damage.",
        ],
      },
      { t: "p", text: "Customers remain entitled to applicable statutory protections regardless of these administrative responsibilities." },
    ],
  },
  {
    title: "Marketplace Role and Dispute Resolution",
    blocks: [
      {
        t: "p",
        text: "Care Runners Market Portal may operate as a marketplace connecting independent sellers with customers. The identity of the seller and the party responsible for a refund or other remedy should be clearly communicated at the point of sale.",
      },
      {
        t: "p",
        text: "Where a dispute arises, customers should first contact the seller or Care Runners support team. Care Runners may facilitate communication and review relevant order information.",
      },
      { t: "p", text: "Nothing in this policy prevents a customer from exercising a legal right or approaching the appropriate consumer protection authority." },
    ],
  },
  {
    title: "Contact Information",
    blocks: [
      {
        t: "p",
        text: "For return, refund, or exchange enquiries, customers should contact Care Runners Market Portal through the support contact details published on the platform.",
      },
      { t: "terms", items: [["Phone", SUPPORT_PHONE]] },
      { t: "p", text: "Please include your order number and a brief description of the issue to help us assist you efficiently." },
    ],
  },
  {
    title: "Policy Updates",
    blocks: [
      {
        t: "p",
        text: "Care Runners Market Portal may update this policy from time to time. The current version will be published on the marketplace. Updates will not retrospectively remove consumer rights that have already accrued.",
      },
    ],
  },
]
