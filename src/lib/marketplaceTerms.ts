// Generated from "SELLER & BUYER TERMS AND CONDITIONS.docx". Edit the wording
// here (and bump TERMS_VERSION) when the terms change.
// 2026-10-20: customers selling their own items (sections 3, 4, 9, 10 and 26).
export const TERMS_VERSION = "2026-10-20"

export type TermsBlock = { t: "p"; text: string } | { t: "ul"; items: string[] }

export interface TermsSection {
  n: number
  title: string
  part: string | null
  blocks: TermsBlock[]
}

export const TERMS_INTRO: TermsBlock[] = [
  {
    "t": "p",
    "text": "Care Runners MarketPortal is a digital marketplace that allows individuals and businesses to advertise and sell pre-owned and used products."
  },
  {
    "t": "p",
    "text": "Sellers may submit photographs, descriptions and their requested selling price to Care Runners. Care Runners may publish the item on its digital platform, promote the item to potential buyers and, where applicable, add a disclosed or agreed markup/service fee."
  },
  {
    "t": "p",
    "text": "A buyer may purchase an advertised item. Every item is collected from the seller and delivered to the buyer by Care Runners at an applicable delivery fee."
  },
  {
    "t": "p",
    "text": "By submitting an item for listing, purchasing an item, requesting delivery or using the MarketPortal, the user agrees to these Terms and Conditions."
  }
]

// Shown before a seller submits a listing (terms section 34).
export const SELLER_ACCEPTANCE = [
  "I own this item or have authority to sell it.",
  "The information and photographs I provided are accurate.",
  "I have disclosed known defects.",
  "The item is not stolen or unlawfully obtained.",
  "I understand that Care Runners may add a markup/service fee.",
  "I understand that delivery may be charged separately.",
  "I agree to the Seller Terms and Conditions.",
]

// Shown before a buyer completes a purchase (terms section 35).
export const BUYER_ACCEPTANCE = [
  "I have reviewed the item's description and photographs.",
  "I understand that the item may be pre-owned/used.",
  "I understand the disclosed condition and defects.",
  "I have confirmed the final purchase price.",
  "I understand the delivery fee, if applicable.",
  "I agree to the Buyer Terms and Conditions.",
]

export const TERMS_SECTIONS: TermsSection[] = [
  {
    "n": 2,
    "title": "SELLER ELIGIBILITY",
    "part": "Part A: Seller Terms",
    "blocks": [
      {
        "t": "p",
        "text": "The Seller confirms that:"
      },
      {
        "t": "ul",
        "items": [
          "they are at least 18 years old, unless otherwise legally permitted;",
          "they have the legal right to sell the item;",
          "the item is not stolen, counterfeit, unlawfully obtained or subject to another person's ownership rights;",
          "all information supplied to Care Runners is truthful and accurate; and",
          "they will comply with all applicable laws."
        ]
      },
      {
        "t": "p",
        "text": "Care Runners may request reasonable proof of ownership or identity before publishing or releasing an item for sale."
      }
    ]
  },
  {
    "n": 3,
    "title": "HOW TO LIST AN ITEM",
    "part": "Part A: Seller Terms",
    "blocks": [
      {
        "t": "p",
        "text": "The Seller may submit an item by providing:"
      },
      {
        "t": "ul",
        "items": [
          "clear photographs;",
          "item name;",
          "description;",
          "condition;",
          "defects or damage;",
          "seller's requested price;",
          "location of the item;",
          "relevant specifications; and",
          "any other information reasonably requested by Care Runners."
        ]
      },
      {
        "t": "p",
        "text": "The Seller must disclose known material defects."
      },
      {
        "t": "p",
        "text": "To sell, the Seller must confirm their email address and provide their seller details: the name shown to buyers, their full name, a phone number, the pickup address and a bank account for payouts."
      },
      {
        "t": "p",
        "text": "Every item is reviewed by Care Runners and is only shown to buyers once Care Runners has approved it. If an item is not approved, the Seller will see the reason in My MarketPortal and may correct the item and submit it again."
      },
      {
        "t": "p",
        "text": "Care Runners may edit the formatting, wording, photographs or presentation of a listing for marketing purposes, without changing the material facts about the item."
      }
    ]
  },
  {
    "n": 4,
    "title": "SELLER'S PRICE AND CARE RUNNERS MARKUP",
    "part": "Part A: Seller Terms",
    "blocks": [
      {
        "t": "p",
        "text": "The Seller must provide the price they wish to receive for the item."
      },
      {
        "t": "p",
        "text": "Care Runners may add a markup, service fee or other agreed amount to establish the final customer selling price."
      },
      {
        "t": "p",
        "text": "Unless otherwise agreed in writing:"
      },
      {
        "t": "p",
        "text": "Seller Price + Care Runners Markup/Service Fee = Customer Selling Price"
      },
      {
        "t": "p",
        "text": "The Care Runners service fee is currently 30% of the Seller's price, paid by the Buyer on top of the Seller's price. It does not reduce the amount the Seller receives. The Seller can see the Customer Selling Price in My MarketPortal once the item is approved."
      },
      {
        "t": "p",
        "text": "The Seller must be informed of the amount they will receive before the item is sold where the Seller's proceeds are affected by the agreed arrangement."
      },
      {
        "t": "p",
        "text": "Care Runners may also charge the Buyer a separate delivery fee where delivery is requested."
      }
    ]
  },
  {
    "n": 5,
    "title": "ITEM CONDITION",
    "part": "Part A: Seller Terms",
    "blocks": [
      {
        "t": "p",
        "text": "Used items must be accurately described as:"
      },
      {
        "t": "ul",
        "items": [
          "New;",
          "Used (Excellent);",
          "Used (Good);",
          "Used (Fair); or",
          "For Parts/Repair,"
        ]
      },
      {
        "t": "p",
        "text": "or another appropriate condition category used by Care Runners."
      },
      {
        "t": "p",
        "text": "The Seller must disclose known:"
      },
      {
        "t": "ul",
        "items": [
          "damage;",
          "faults;",
          "missing parts;",
          "repairs;",
          "modifications;",
          "defects;",
          "battery problems;",
          "water damage;",
          "software/activation locks; and",
          "other issues that could reasonably affect the Buyer's decision."
        ]
      }
    ]
  },
  {
    "n": 6,
    "title": "AUTHENTICITY AND OWNERSHIP",
    "part": "Part A: Seller Terms",
    "blocks": [
      {
        "t": "p",
        "text": "The Seller guarantees that the item is legally owned by them or that they have authority to sell it."
      },
      {
        "t": "p",
        "text": "The Seller must not submit:"
      },
      {
        "t": "ul",
        "items": [
          "stolen goods;",
          "counterfeit goods;",
          "illegally imported goods;",
          "goods subject to a dispute;",
          "goods belonging to another person without authority;",
          "fraudulent goods;",
          "stolen electronic devices;",
          "devices containing another person's private information;",
          "illegally obtained software or digital content; or",
          "any prohibited item."
        ]
      },
      {
        "t": "p",
        "text": "Care Runners may remove a listing immediately if ownership or legality is questioned."
      }
    ]
  },
  {
    "n": 7,
    "title": "ELECTRONIC DEVICES",
    "part": "Part A: Seller Terms",
    "blocks": [
      {
        "t": "p",
        "text": "Before selling a phone, tablet, computer, gaming console or other electronic device, the Seller must:"
      },
      {
        "t": "ul",
        "items": [
          "remove personal accounts;",
          "remove passwords;",
          "perform an appropriate factory reset;",
          "remove SIM cards and memory cards where applicable;",
          "remove personal information; and",
          "ensure that the device is not subject to an activation lock."
        ]
      },
      {
        "t": "p",
        "text": "The Seller remains responsible for any personal information left on a device."
      }
    ]
  },
  {
    "n": 8,
    "title": "ACCEPTANCE OF LISTING",
    "part": "Part A: Seller Terms",
    "blocks": [
      {
        "t": "p",
        "text": "Care Runners reserves the right to:"
      },
      {
        "t": "ul",
        "items": [
          "approve or reject a listing;",
          "request additional information;",
          "request additional photographs;",
          "change the category;",
          "temporarily suspend a listing;",
          "remove a listing;",
          "refuse prohibited or suspicious items; or",
          "cancel a transaction where fraud or unlawful activity is suspected."
        ]
      },
      {
        "t": "p",
        "text": "Listing an item does not guarantee that the item will sell."
      }
    ]
  },
  {
    "n": 9,
    "title": "SELLER AVAILABILITY",
    "part": "Part A: Seller Terms",
    "blocks": [
      {
        "t": "p",
        "text": "The Seller must keep the item available while it is advertised."
      },
      {
        "t": "p",
        "text": "If the item is sold elsewhere, withdrawn or becomes unavailable, the Seller must immediately take it down using Take down in My MarketPortal, or notify Care Runners."
      },
      {
        "t": "p",
        "text": "An item cannot be taken down while a buyer is paying for it or after it has been sold. In that case the Seller must contact Care Runners immediately."
      },
      {
        "t": "p",
        "text": "A Seller must not accept payment from a Buyer through another channel after Care Runners has confirmed the transaction without notifying Care Runners."
      }
    ]
  },
  {
    "n": 10,
    "title": "PAYMENT TO THE SELLER",
    "part": "Part A: Seller Terms",
    "blocks": [
      {
        "t": "p",
        "text": "Seller payment will be processed according to the payment arrangement displayed or agreed at the time of the transaction."
      },
      {
        "t": "p",
        "text": "Unless otherwise agreed, Care Runners pays the Seller's price by EFT into the bank account in the Seller's details after the item has been delivered to the Buyer."
      },
      {
        "t": "p",
        "text": "Care Runners may delay payment where:"
      },
      {
        "t": "ul",
        "items": [
          "the transaction is under investigation;",
          "the Buyer has reported a material problem;",
          "fraud is suspected;",
          "delivery has not been completed;",
          "the item received does not correspond materially with the listing; or",
          "additional verification is required."
        ]
      },
      {
        "t": "p",
        "text": "The Seller is responsible for providing correct banking/payment information."
      }
    ]
  },
  {
    "n": 11,
    "title": "BUYER RESPONSIBILITY",
    "part": "Part B: Buyer Terms",
    "blocks": [
      {
        "t": "p",
        "text": "Before purchasing an item, the Buyer should carefully review:"
      },
      {
        "t": "ul",
        "items": [
          "photographs;",
          "description;",
          "condition;",
          "specifications;",
          "disclosed defects;",
          "selling price; and",
          "delivery information."
        ]
      },
      {
        "t": "p",
        "text": "Where reasonably possible, Buyers should inspect an item on delivery (see section 16)."
      }
    ]
  },
  {
    "n": 12,
    "title": "USED GOODS",
    "part": "Part B: Buyer Terms",
    "blocks": [
      {
        "t": "p",
        "text": "Buyers acknowledge that MarketPortal may contain pre-owned goods."
      },
      {
        "t": "p",
        "text": "Used goods may show reasonable signs of previous use."
      },
      {
        "t": "p",
        "text": "The Buyer should not assume that a used item is in new condition unless the listing expressly states otherwise."
      }
    ]
  },
  {
    "n": 13,
    "title": "PURCHASE PRICE",
    "part": "Part B: Buyer Terms",
    "blocks": [
      {
        "t": "p",
        "text": "The Buyer must pay the final price displayed at checkout or otherwise confirmed by Care Runners."
      },
      {
        "t": "p",
        "text": "The final amount may include:"
      },
      {
        "t": "ul",
        "items": [
          "item selling price;",
          "Care Runners markup/service fee, where applicable;",
          "delivery fee, where applicable; and",
          "other disclosed charges."
        ]
      },
      {
        "t": "p",
        "text": "No additional undisclosed charge should be added to the Buyer's transaction."
      }
    ]
  },
  {
    "n": 14,
    "title": "COLLECTION FROM THE SELLER",
    "part": "Part B: Buyer Terms",
    "blocks": [
      {
        "t": "p",
        "text": "All MarketPortal items are collected from the Seller and delivered to the Buyer by Care Runners. The Seller must:"
      },
      {
        "t": "ul",
        "items": [
          "have the item available at the pickup address provided in the listing;",
          "release the item only to a Care Runners driver or another person authorised by Care Runners;",
          "allow the driver to confirm that the item matches the listing; and",
          "follow Care Runners' instructions for confirming collection."
        ]
      },
      {
        "t": "p",
        "text": "The Buyer and Seller must not use collection or delivery arrangements to bypass Care Runners' agreed transaction process."
      }
    ]
  },
  {
    "n": 15,
    "title": "CARE RUNNERS DELIVERY",
    "part": "Part B: Buyer Terms",
    "blocks": [
      {
        "t": "p",
        "text": "Where the Buyer requests delivery:"
      },
      {
        "t": "ul",
        "items": [
          "the delivery fee will be communicated before confirmation;",
          "delivery times are estimates unless expressly confirmed as guaranteed;",
          "delays may occur because of traffic, weather, vehicle problems, incorrect addresses, access problems or other circumstances outside Care Runners' reasonable control;",
          "the Buyer must provide a correct delivery address and contact number."
        ]
      },
      {
        "t": "p",
        "text": "The item may be delivered from the Seller directly to the Buyer or through another approved fulfilment arrangement."
      }
    ]
  },
  {
    "n": 16,
    "title": "INSPECTION ON DELIVERY",
    "part": "Part B: Buyer Terms",
    "blocks": [
      {
        "t": "p",
        "text": "The Buyer should inspect the item upon delivery."
      },
      {
        "t": "p",
        "text": "Where there is visible damage or a material discrepancy between the item and the listing, the Buyer should immediately notify Care Runners and provide photographs or other evidence."
      },
      {
        "t": "p",
        "text": "The Buyer should not intentionally damage, modify or misuse an item and then request a refund."
      }
    ]
  },
  {
    "n": 17,
    "title": "RETURNS AND REFUNDS",
    "part": "Part C: Returns, Refunds And Disputes",
    "blocks": [
      {
        "t": "p",
        "text": "Returns and refunds will depend on:"
      },
      {
        "t": "ul",
        "items": [
          "the nature of the item;",
          "the reason for the return;",
          "the condition of the item;",
          "whether the item materially differed from the listing;",
          "applicable consumer law; and",
          "whether the Seller is a private individual or a business acting in the ordinary course of business."
        ]
      },
      {
        "t": "p",
        "text": "Nothing in these Terms is intended to remove or limit any mandatory consumer right that cannot lawfully be excluded."
      },
      {
        "t": "p",
        "text": "South Africa's Consumer Protection Act establishes consumer-protection standards and regulates consumer transactions and agreements."
      }
    ]
  },
  {
    "n": 18,
    "title": "INCORRECT OR MISREPRESENTED ITEM",
    "part": "Part C: Returns, Refunds And Disputes",
    "blocks": [
      {
        "t": "p",
        "text": "If an item is materially different from its listing, Care Runners may investigate the matter and may require the Seller and Buyer to provide:"
      },
      {
        "t": "ul",
        "items": [
          "photographs;",
          "videos;",
          "proof of payment;",
          "listing information;",
          "communication records; and",
          "other relevant evidence."
        ]
      },
      {
        "t": "p",
        "text": "Where appropriate, Care Runners may facilitate a return, refund, replacement or other resolution."
      }
    ]
  },
  {
    "n": 19,
    "title": "DISPUTE PROCESS",
    "part": "Part C: Returns, Refunds And Disputes",
    "blocks": [
      {
        "t": "p",
        "text": "Buyers and Sellers should first report disputes to Care Runners."
      },
      {
        "t": "p",
        "text": "Care Runners may attempt to facilitate a reasonable resolution."
      },
      {
        "t": "p",
        "text": "Care Runners does not guarantee that every dispute will be resolved in favour of either party."
      },
      {
        "t": "p",
        "text": "Where the parties cannot resolve a dispute, either party retains their legal rights and remedies under applicable South African law."
      }
    ]
  },
  {
    "n": 20,
    "title": "PROHIBITED PRODUCTS",
    "part": "Part D: Prohibited Items",
    "blocks": [
      {
        "t": "p",
        "text": "The following may not be listed without appropriate legal authorisation and platform approval, and some categories may be completely prohibited:"
      },
      {
        "t": "ul",
        "items": [
          "stolen goods;",
          "counterfeit goods;",
          "illegal drugs;",
          "firearms and ammunition;",
          "explosives;",
          "illegal weapons;",
          "stolen identification documents;",
          "hacked or compromised accounts;",
          "illegally obtained personal information;",
          "hazardous or unlawful materials;",
          "fraudulent documents;",
          "recalled or unsafe products where sale is prohibited;",
          "goods that infringe intellectual-property rights; and",
          "any other item prohibited by South African law or Care Runners' marketplace rules."
        ]
      },
      {
        "t": "p",
        "text": "Care Runners may immediately remove suspicious listings and, where legally required or appropriate, report suspected unlawful activity to the relevant authorities."
      }
    ]
  },
  {
    "n": 21,
    "title": "FRAUD PREVENTION",
    "part": "Part E: Fraud And Platform Safety",
    "blocks": [
      {
        "t": "p",
        "text": "Users must not:"
      },
      {
        "t": "ul",
        "items": [
          "create fake accounts;",
          "submit false information;",
          "use stolen payment details;",
          "manipulate prices fraudulently;",
          "submit fake proof of payment;",
          "impersonate another person;",
          "advertise an item that does not exist;",
          "attempt to bypass Care Runners' transaction system;",
          "use the platform to launder money; or",
          "engage in any fraudulent activity."
        ]
      },
      {
        "t": "p",
        "text": "Care Runners may suspend accounts and transactions where fraud is suspected."
      }
    ]
  },
  {
    "n": 22,
    "title": "PROOF OF PAYMENT",
    "part": "Part E: Fraud And Platform Safety",
    "blocks": [
      {
        "t": "p",
        "text": "A screenshot or message claiming that payment has been made does not necessarily constitute confirmation of cleared funds."
      },
      {
        "t": "p",
        "text": "Users should rely on Care Runners' official transaction/payment confirmation."
      }
    ]
  },
  {
    "n": 23,
    "title": "MARKETPLACE FACILITATION",
    "part": "Part F: Care Runners' Role",
    "blocks": [
      {
        "t": "p",
        "text": "Unless expressly stated otherwise for a particular transaction, Care Runners operates MarketPortal as a marketplace and transaction facilitation service."
      },
      {
        "t": "p",
        "text": "Care Runners may:"
      },
      {
        "t": "ul",
        "items": [
          "advertise Seller items;",
          "facilitate communication;",
          "process or facilitate payments;",
          "add an agreed markup/service fee;",
          "arrange collection from the Seller;",
          "arrange delivery;",
          "provide customer support;",
          "manage transaction records; and",
          "assist with disputes."
        ]
      },
      {
        "t": "p",
        "text": "The specific legal role of Care Runners in each transaction should be clearly stated in the app and transaction confirmation."
      }
    ]
  },
  {
    "n": 24,
    "title": "NO GUARANTEE OF SALE",
    "part": "Part F: Care Runners' Role",
    "blocks": [
      {
        "t": "p",
        "text": "Care Runners does not guarantee that a listed item will sell within a particular period."
      },
      {
        "t": "p",
        "text": "Any marketing statement such as “sell within 30 minutes to 24 hours” should be treated as a target or estimated turnaround and not a guaranteed sale unless Care Runners expressly confirms otherwise."
      }
    ]
  },
  {
    "n": 25,
    "title": "DELIVERY LIMITATIONS",
    "part": "Part F: Care Runners' Role",
    "blocks": [
      {
        "t": "p",
        "text": "Care Runners will make reasonable efforts to complete deliveries within the communicated timeframe."
      },
      {
        "t": "p",
        "text": "Care Runners is not responsible for delays caused by circumstances reasonably outside its control."
      }
    ]
  },
  {
    "n": 26,
    "title": "PERSONAL INFORMATION",
    "part": "Part G: Personal Information",
    "blocks": [
      {
        "t": "p",
        "text": "Care Runners may collect and process personal information necessary to operate MarketPortal, including:"
      },
      {
        "t": "ul",
        "items": [
          "name;",
          "telephone number;",
          "email address;",
          "delivery address;",
          "payment-related information;",
          "a Seller's pickup address and bank account details for payouts;",
          "identification information where verification is required; and",
          "communications relating to a transaction."
        ]
      },
      {
        "t": "p",
        "text": "Buyers see only the suburb and city of a Seller's pickup address, never the full address. The Seller's phone number and pickup address are shared only with the Care Runners driver who collects the item. Bank details are used only to pay the Seller."
      },
      {
        "t": "p",
        "text": "Personal information must be handled in accordance with applicable South African privacy laws and Care Runners' Privacy Policy."
      },
      {
        "t": "p",
        "text": "POPIA is administered and enforced by South Africa's Information Regulator, which provides compliance resources for organisations processing personal information."
      }
    ]
  },
  {
    "n": 27,
    "title": "SHARING INFORMATION",
    "part": "Part G: Personal Information",
    "blocks": [
      {
        "t": "p",
        "text": "Care Runners may share necessary transaction information with:"
      },
      {
        "t": "ul",
        "items": [
          "the Seller;",
          "the Buyer;",
          "delivery personnel;",
          "payment providers;",
          "technology/service providers; or",
          "authorities where legally required."
        ]
      },
      {
        "t": "p",
        "text": "Only information reasonably required to facilitate the transaction should be shared."
      }
    ]
  },
  {
    "n": 28,
    "title": "ELECTRONIC ACCEPTANCE",
    "part": "Part H: Electronic Agreement",
    "blocks": [
      {
        "t": "p",
        "text": "By selecting “I Agree”, clicking “Accept Terms”, submitting a listing, placing an order or otherwise using MarketPortal, the user acknowledges that they have read and accepted these Terms and Conditions."
      },
      {
        "t": "p",
        "text": "South Africa's Electronic Communications and Transactions Act provides a legal framework for electronic communications and transactions and contains provisions concerning electronic transactions and consumer information."
      }
    ]
  },
  {
    "n": 29,
    "title": "RECORDS",
    "part": "Part H: Electronic Agreement",
    "blocks": [
      {
        "t": "p",
        "text": "Care Runners may maintain electronic records of:"
      },
      {
        "t": "ul",
        "items": [
          "listings;",
          "orders;",
          "payments;",
          "delivery information;",
          "messages;",
          "acceptance of terms;",
          "transaction confirmations; and",
          "dispute records."
        ]
      }
    ]
  },
  {
    "n": 30,
    "title": "USER RESPONSIBILITY",
    "part": "Part I: Limitation And Responsibility",
    "blocks": [
      {
        "t": "p",
        "text": "Each Seller and Buyer remains responsible for the accuracy of information they provide."
      },
      {
        "t": "p",
        "text": "Nothing in these Terms excludes any liability or consumer protection that cannot legally be excluded under applicable law."
      }
    ]
  },
  {
    "n": 31,
    "title": "CARE RUNNERS PLATFORM",
    "part": "Part I: Limitation And Responsibility",
    "blocks": [
      {
        "t": "p",
        "text": "Care Runners will take reasonable measures to operate a secure marketplace, but no online platform can guarantee that it will always be free from technical failures, fraud, cyberattacks or interruptions."
      },
      {
        "t": "p",
        "text": "Users should report suspicious activity immediately."
      }
    ]
  },
  {
    "n": 32,
    "title": "UPDATES",
    "part": "Part J: Changes To Terms",
    "blocks": [
      {
        "t": "p",
        "text": "Care Runners may update these Terms and Conditions from time to time."
      },
      {
        "t": "p",
        "text": "The latest version will be made available through the Care Runners platform."
      },
      {
        "t": "p",
        "text": "Where legally required, users will be notified of material changes."
      }
    ]
  },
  {
    "n": 33,
    "title": "SOUTH AFRICAN LAW",
    "part": "Part K: Governing Law",
    "blocks": [
      {
        "t": "p",
        "text": "These Terms and Conditions are governed by the laws of the Republic of South Africa."
      },
      {
        "t": "p",
        "text": "Any dispute will be dealt with through the appropriate dispute-resolution or legal process available under applicable South African law."
      }
    ]
  }
]
