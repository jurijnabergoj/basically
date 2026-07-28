export type Topic = {
  id: string;
  prompt: string;
  category: "Physics" | "Engineering" | "Biology" | "Economics";
};

export const topics: Topic[] = [
  // --- Physics & natural phenomena ---
  { id: "sky-blue", prompt: "Why the sky is blue", category: "Physics" },
  { id: "red-sunsets", prompt: "Why sunsets turn red and orange", category: "Physics" },
  { id: "tides", prompt: "How ocean tides (high and low) work", category: "Physics" },
  { id: "moon-phases", prompt: "Why the moon has phases", category: "Physics" },
  { id: "seasons", prompt: "Why we have seasons", category: "Physics" },
  { id: "rainbows", prompt: "How rainbows form", category: "Physics" },
  { id: "ocean-salty", prompt: "Why the ocean is salty", category: "Physics" },
  { id: "clouds", prompt: "How clouds form", category: "Physics" },
  { id: "rain", prompt: "Why it rains", category: "Physics" },
  { id: "lightning", prompt: "How lightning forms", category: "Physics" },
  { id: "thunder", prompt: "Why thunder follows lightning", category: "Physics" },
  { id: "earth-magnetic", prompt: "Why Earth has a magnetic field (and why a compass points north)", category: "Physics" },
  { id: "ice-floats", prompt: "Why ice floats on water", category: "Physics" },
  { id: "mirror", prompt: "How a mirror reflects your image", category: "Physics" },
  { id: "gravity", prompt: "Why things fall (how gravity works)", category: "Physics" },
  { id: "sun-energy", prompt: "How the sun produces energy", category: "Physics" },
  { id: "magnet", prompt: "How a magnet works", category: "Physics" },
  { id: "metal-cold", prompt: "Why metal feels colder than wood at the same temperature", category: "Physics" },
  { id: "noise-cancelling", prompt: "How noise-cancelling headphones work", category: "Physics" },
  { id: "helium-voice", prompt: "Why helium makes your voice squeaky", category: "Physics" },
  { id: "microwave", prompt: "How a microwave oven heats food", category: "Physics" },
  { id: "wind", prompt: "Why the wind blows", category: "Physics" },
  { id: "echo", prompt: "How echoes work", category: "Physics" },
  { id: "straw-bent", prompt: "Why a straw looks bent in a glass of water", category: "Physics" },
  { id: "night-dark", prompt: "Why the sky is dark at night", category: "Physics" },
  { id: "prism", prompt: "How a prism splits light into colors", category: "Physics" },

  // --- Engineering & everyday technology ---
  { id: "water-home", prompt: "How water gets to your home", category: "Engineering" },
  { id: "electric-grid", prompt: "How electricity reaches your house (the power grid)", category: "Engineering" },
  { id: "fridge", prompt: "How a refrigerator stays cold", category: "Engineering" },
  { id: "air-conditioner", prompt: "How an air conditioner cools a room", category: "Engineering" },
  { id: "toilet", prompt: "How a toilet flushes", category: "Engineering" },
  { id: "zipper", prompt: "How a zipper works", category: "Engineering" },
  { id: "plane-lift", prompt: "How planes generate lift", category: "Engineering" },
  { id: "wifi", prompt: "How Wi-Fi transmits data", category: "Engineering" },
  { id: "gps", prompt: "How GPS knows your location", category: "Engineering" },
  { id: "touchscreen", prompt: "How a touchscreen detects your finger", category: "Engineering" },
  { id: "battery", prompt: "How a battery stores and releases energy", category: "Engineering" },
  { id: "car-engine", prompt: "How a car engine works", category: "Engineering" },
  { id: "electric-motor", prompt: "How an electric motor works", category: "Engineering" },
  { id: "led", prompt: "How an LED produces light", category: "Engineering" },
  { id: "webpage", prompt: "How the internet delivers a webpage to you", category: "Engineering" },
  { id: "email", prompt: "How email gets delivered", category: "Engineering" },
  { id: "search-engine", prompt: "How a search engine ranks its results", category: "Engineering" },
  { id: "qr-code", prompt: "How a QR code stores information", category: "Engineering" },
  { id: "credit-card", prompt: "How a credit card payment is processed", category: "Engineering" },
  { id: "lock-key", prompt: "How a pin-tumbler lock and key work", category: "Engineering" },
  { id: "thermostat", prompt: "How a thermostat regulates temperature", category: "Engineering" },
  { id: "dishwasher", prompt: "How a dishwasher cleans dishes", category: "Engineering" },
  { id: "washing-machine", prompt: "How a washing machine works", category: "Engineering" },
  { id: "vacuum-cleaner", prompt: "How a vacuum cleaner picks up dirt", category: "Engineering" },
  { id: "digital-camera", prompt: "How a digital camera captures an image", category: "Engineering" },
  { id: "speaker", prompt: "How a speaker produces sound", category: "Engineering" },
  { id: "microphone", prompt: "How a microphone works", category: "Engineering" },
  { id: "ssd", prompt: "How a solid-state drive stores data", category: "Engineering" },
  { id: "solar-panel", prompt: "How a solar panel makes electricity", category: "Engineering" },
  { id: "wind-turbine", prompt: "How a wind turbine generates power", category: "Engineering" },
  { id: "nuclear-plant", prompt: "How a nuclear power plant makes electricity", category: "Engineering" },
  { id: "hydro-dam", prompt: "How a hydroelectric dam works", category: "Engineering" },
  { id: "car-brakes", prompt: "How a car's brakes stop the wheels", category: "Engineering" },
  { id: "jet-engine", prompt: "How a jet engine works", category: "Engineering" },
  { id: "helicopter", prompt: "How a helicopter flies", category: "Engineering" },
  { id: "submarine", prompt: "How a submarine dives and surfaces", category: "Engineering" },
  { id: "hot-air-balloon", prompt: "How a hot air balloon rises", category: "Engineering" },
  { id: "suspension-bridge", prompt: "How a suspension bridge holds its weight", category: "Engineering" },
  { id: "concrete", prompt: "How concrete hardens", category: "Engineering" },
  { id: "smoke-detector", prompt: "How a smoke detector detects smoke", category: "Engineering" },
  { id: "thermos", prompt: "How a vacuum flask (thermos) keeps drinks hot or cold", category: "Engineering" },
  { id: "bicycle-balance", prompt: "How a bicycle stays upright when moving", category: "Engineering" },
  { id: "heat-pump", prompt: "How a heat pump heats a home", category: "Engineering" },
  { id: "fiber-optic", prompt: "How fiber optic cables carry data", category: "Engineering" },

  // --- Biology & the human body ---
  { id: "vaccines", prompt: "How vaccines create immunity", category: "Biology" },
  { id: "antibiotics", prompt: "How antibiotics kill bacteria", category: "Biology" },
  { id: "antibiotics-virus", prompt: "Why antibiotics don't work on viruses", category: "Biology" },
  { id: "digestion", prompt: "How your body digests food", category: "Biology" },
  { id: "eyes-see", prompt: "How your eyes focus and let you see", category: "Biology" },
  { id: "ears-hear", prompt: "How your ears let you hear", category: "Biology" },
  { id: "fever", prompt: "Why you get a fever when you're sick", category: "Biology" },
  { id: "blood-clot", prompt: "How a cut heals and blood clots", category: "Biology" },
  { id: "goosebumps", prompt: "Why you get goosebumps", category: "Biology" },
  { id: "body-temp", prompt: "How your body keeps a constant temperature", category: "Biology" },
  { id: "muscles", prompt: "How muscles contract", category: "Biology" },
  { id: "memory", prompt: "How your brain stores memories", category: "Biology" },
  { id: "dreams", prompt: "Why you dream", category: "Biology" },
  { id: "anesthesia", prompt: "How anesthesia works", category: "Biology" },
  { id: "kidneys", prompt: "How your kidneys filter blood", category: "Biology" },
  { id: "liver", prompt: "What your liver actually does", category: "Biology" },
  { id: "breathing", prompt: "Why you need to breathe (what your body does with oxygen)", category: "Biology" },
  { id: "photosynthesis", prompt: "How photosynthesis works", category: "Biology" },
  { id: "autumn-leaves", prompt: "Why leaves change color in autumn", category: "Biology" },
  { id: "seed-plant", prompt: "How a seed becomes a plant", category: "Biology" },
  { id: "yeast-bread", prompt: "How yeast makes bread rise", category: "Biology" },
  { id: "fermentation", prompt: "How fermentation makes alcohol", category: "Biology" },
  { id: "exercise-strength", prompt: "Why exercise makes muscles stronger", category: "Biology" },
  { id: "immune-cold", prompt: "How your immune system fights off a cold", category: "Biology" },
  { id: "allergies", prompt: "Why you get seasonal allergies", category: "Biology" },
  { id: "dna", prompt: "How DNA carries genetic information", category: "Biology" },
  { id: "genes-traits", prompt: "How your genes determine your traits", category: "Biology" },
  { id: "resemble-parents", prompt: "Why children resemble their parents", category: "Biology" },
  { id: "evolution", prompt: "How evolution produces new species", category: "Biology" },
  { id: "butterfly", prompt: "How a caterpillar becomes a butterfly", category: "Biology" },
  { id: "aging", prompt: "Why we age", category: "Biology" },
  { id: "caffeine", prompt: "How caffeine keeps you awake", category: "Biology" },
  { id: "smell", prompt: "How your sense of smell works", category: "Biology" },
  { id: "hunger-full", prompt: "How your body knows when you're full", category: "Biology" },
  { id: "onion-cry", prompt: "Why onions make you cry", category: "Biology" },
  { id: "sunscreen", prompt: "How sunscreen protects your skin", category: "Biology" },

  // --- Economics & finance ---
  { id: "inflation", prompt: "How inflation happens", category: "Economics" },
  { id: "stock-market", prompt: "What the stock market does, and why stock prices move", category: "Economics" },
  { id: "interest-rates", prompt: "How interest rates affect the economy", category: "Economics" },
  { id: "bank-money", prompt: "How a bank actually makes money", category: "Economics" },
  { id: "credit-score", prompt: "How credit scores are calculated", category: "Economics" },
  { id: "fiat-money", prompt: "Why paper money has value (fiat money)", category: "Economics" },
  { id: "central-bank", prompt: "What a central bank does", category: "Economics" },
  { id: "compound-interest", prompt: "How compound interest grows money", category: "Economics" },
  { id: "recession", prompt: "What a recession is, and why they happen", category: "Economics" },
  { id: "insurance", prompt: "How insurance companies make money", category: "Economics" },
  { id: "gdp", prompt: "What GDP measures", category: "Economics" },
  { id: "supply-demand", prompt: "How supply and demand set prices", category: "Economics" },
  { id: "mortgage", prompt: "How a mortgage works", category: "Economics" },
  { id: "crypto", prompt: "What cryptocurrency actually is", category: "Economics" },
  { id: "exchange-rates", prompt: "How currency exchange rates work", category: "Economics" },
  { id: "country-wealth", prompt: "Why some countries are richer than others", category: "Economics" },
  { id: "national-debt", prompt: "How the national debt works", category: "Economics" },
  { id: "taxes", prompt: "How taxes fund government", category: "Economics" },
  { id: "ipo", prompt: "How a company's stock IPO works", category: "Economics" },
];

const topicsById: Record<string, Topic> = Object.fromEntries(
  topics.map((t) => [t.id, t]),
);

export function getTopicById(id: string): Topic | undefined {
  return topicsById[id];
}

export function randomTopic(exclude?: string): Topic {
  if (topics.length === 1) return topics[0];
  let pick = topics[Math.floor(Math.random() * topics.length)];
  while (exclude && pick.id === exclude) {
    pick = topics[Math.floor(Math.random() * topics.length)];
  }
  return pick;
}
