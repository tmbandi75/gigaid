export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  services: string[];
}

export const serviceCategories: ServiceCategory[] = [
  {
    id: "handyman",
    name: "Handyman / General Home Services",
    icon: "🛠️",
    services: [
      "General Handyman Work",
      "Furniture Assembly",
      "TV Mounting",
      "Picture / Shelf Hanging",
      "Door & Lock Repair",
      "Drywall Repair",
      "Small Home Repairs",
    ],
  },
  {
    id: "plumbing",
    name: "Plumbing",
    icon: "🚿",
    services: [
      "Faucet Repair / Replacement",
      "Toilet Repair",
      "Drain Cleaning",
      "Leak Detection",
      "Water Heater Service",
      "Garbage Disposal Repair",
      "Emergency Plumbing",
    ],
  },
  {
    id: "electrical",
    name: "Electrical",
    icon: "⚡",
    services: [
      "Light Fixture Installation",
      "Outlet / Switch Repair",
      "Ceiling Fan Installation",
      "Circuit Breaker Issues",
      "Smart Device Installation",
      "Emergency Electrical",
    ],
  },
  {
    id: "cleaning",
    name: "Cleaning",
    icon: "🧹",
    services: [
      "Standard Home Cleaning",
      "Deep Cleaning",
      "Move-In / Move-Out Cleaning",
      "Office Cleaning",
      "Post-Construction Cleaning",
      "Airbnb / Rental Turnover",
      "Carpet Cleaning",
    ],
  },
  {
    id: "interior-care",
    name: "Interior Care & Organization",
    icon: "🧽",
    services: [
      "Home Organization",
      "Decluttering Services",
      "Closet Organization",
      "Pantry Organization",
      "Laundry / Ironing Service",
    ],
  },
  {
    id: "lawn-outdoor",
    name: "Lawn & Outdoor",
    icon: "🌿",
    services: [
      "Lawn Mowing",
      "Yard Cleanup",
      "Mulching",
      "Hedge Trimming",
      "Leaf Removal",
      "Snow Removal",
      "Pressure Washing",
    ],
  },
  {
    id: "windows-exterior",
    name: "Windows & Exterior Care",
    icon: "🪟",
    services: [
      "Window Cleaning",
      "Gutter Cleaning",
      "Roof Debris Removal",
      "Exterior Cleaning",
    ],
  },
  {
    id: "flooring",
    name: "Flooring & Surfaces",
    icon: "🧱",
    services: [
      "Tile Repair",
      "Floor Installation (Vinyl / Laminate)",
      "Floor Refinishing",
      "Grout Cleaning",
      "Concrete Repair",
    ],
  },
  {
    id: "carpentry",
    name: "Carpentry & Light Remodeling",
    icon: "🪚",
    services: [
      "Cabinet Installation",
      "Trim & Molding",
      "Deck Repair",
      "Fence Repair",
      "Small Remodel Projects",
    ],
  },
  {
    id: "hvac",
    name: "HVAC (Light / Non-Licensed)",
    icon: "❄️",
    services: [
      "AC Tune-Up",
      "Furnace Check",
      "Filter Replacement",
      "Thermostat Installation",
      "HVAC Diagnostics (Non-Repair)",
    ],
  },
  {
    id: "moving",
    name: "Moving & Labor",
    icon: "📦",
    services: [
      "Local Moving Help",
      "Furniture Moving",
      "Loading / Unloading",
      "Junk Removal",
      "Donation Drop-Off",
    ],
  },
  {
    id: "auto",
    name: "Auto & Mobile Services",
    icon: "🚗",
    services: [
      "Mobile Car Wash",
      "Interior Detailing",
      "Battery Replacement",
      "Tire Change",
      "Jump Start",
    ],
  },
  {
    id: "security",
    name: "Security & Smart Home",
    icon: "🔐",
    services: [
      "Smart Lock Installation",
      "Camera Installation",
      "Doorbell Camera Setup",
      "Wi-Fi Setup / Troubleshooting",
    ],
  },
  {
    id: "hair-beauty",
    name: "Hair & Beauty",
    icon: "✂️",
    services: [
      "Men's Haircut",
      "Women's Haircut",
      "Children's Haircut",
      "Hair Styling",
      "Blowout",
      "Hair Coloring",
      "Highlights / Balayage",
      "Beard Trim",
      "Shampoo & Style",
      "Bridal / Event Hair",
      "Mobile Haircut",
    ],
  },
  {
    id: "child-care",
    name: "Child Care",
    icon: "👶",
    services: [
      "Babysitting (Hourly)",
      "After-School Care",
      "Date Night Babysitting",
      "Short-Term Nanny",
      "Overnight Child Care",
    ],
  },
  {
    id: "pet-care",
    name: "Pet Care",
    icon: "🐶",
    services: [
      "Dog Walking",
      "Dog Sitting",
      "Doggy Day Care",
      "Pet Feeding / Check-Ins",
      "Overnight Pet Sitting",
    ],
  },
  {
    id: "house-care",
    name: "House Care / Sitting",
    icon: "🏡",
    services: [
      "House Sitting",
      "Plant Care",
      "Mail Collection",
      "Vacation Home Check-Ins",
    ],
  },
  {
    id: "wellness",
    name: "Wellness & Personal Services",
    icon: "💆",
    services: [
      "Massage Therapy",
      "Personal Training",
      "Yoga Instruction (Private)",
      "Stretch Therapy",
      "Reiki / Energy Work",
      "Mobile Spa Services",
    ],
  },
  {
    id: "creative",
    name: "Creative & Media",
    icon: "📸",
    services: [
      "Photography (Events / Portraits)",
      "Videography (Short-Form)",
      "Drone Photography",
      "Photo Editing",
      "Video Editing",
      "Content Creation (Social Media)",
    ],
  },
  {
    id: "events",
    name: "Events & Entertainment",
    icon: "🎉",
    services: [
      "DJ Services",
      "MC / Host",
      "Party Setup / Teardown",
      "Balloon Decoration",
      "Event Coordination (Small)",
      "Photo Booth Operation",
    ],
  },
  {
    id: "education",
    name: "Education & Tutoring",
    icon: "🧠",
    services: [
      "Academic Tutoring",
      "Test Prep",
      "Music Lessons",
      "Language Lessons",
      "Homework Help",
      "Skill Coaching",
    ],
  },
  {
    id: "specialty-cleaning",
    name: "Specialty Cleaning & Restoration",
    icon: "🧼",
    services: [
      "Hoarding Cleanup",
      "Biohazard Cleaning",
      "Mold Inspection (Non-Remediation)",
      "Post-Disaster Cleanup",
      "Advanced Vehicle Detailing",
    ],
  },
  {
    id: "professional",
    name: "Professional Solo Services",
    icon: "🛡️",
    services: [
      "Notary Public",
      "Process Server",
      "Mobile Fingerprinting",
      "Field Inspector",
      "Property Inspection (Non-Licensed)",
    ],
  },
  {
    id: "tech-help",
    name: "Tech Help (Non-Enterprise)",
    icon: "🧑‍💻",
    services: [
      "Computer Setup",
      "Wi-Fi Troubleshooting",
      "Printer Setup",
      "Phone / Tablet Help",
      "Smart TV Setup",
      "Tech Help for Seniors",
    ],
  },
  {
    id: "concierge",
    name: "Personal & Concierge Services",
    icon: "🧳",
    services: [
      "Errand Running",
      "Personal Assistant (Hourly)",
      "Travel Packing / Unpacking",
      "Vacation Prep Services",
    ],
  },
  {
    id: "inspection",
    name: "Inspection & Verification",
    icon: "🪜",
    services: [
      "Property Walkthroughs",
      "Move-Out Inspections",
      "Rental Readiness Checks",
      "Insurance Photo Inspections",
      "Field Verification Jobs",
    ],
  },
  {
    id: "seasonal",
    name: "Seasonal / On-Demand",
    icon: "🎄",
    services: [
      "Holiday Decorating",
      "Holiday Light Installation",
      "Event Cleanup",
      "Seasonal Yard Prep",
      "Storm Prep / Light Cleanup",
    ],
  },
  {
    id: "other",
    name: "Other",
    icon: "🧰",
    services: ["Custom Job / Other"],
  },
];

export const allServices: string[] = serviceCategories.flatMap(
  (cat) => cat.services
);

export function findCategoryForService(
  service: string
): ServiceCategory | undefined {
  return serviceCategories.find((cat) => cat.services.includes(service));
}

export function getCategoryIcon(service: string): string {
  const category = findCategoryForService(service);
  return category?.icon || "🧰";
}
