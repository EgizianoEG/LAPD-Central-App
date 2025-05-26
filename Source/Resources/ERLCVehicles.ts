import type { Vehicles } from "@Typings/Resources.js";
import { FormatVehicleName } from "@Utilities/Strings/Formatters.js";

/**
 * An array containing data for all ERLC vehicles, grouped by brand.
 *
 * **Disclaimer:**
 * This file and mapping of game-specific vehicles to real-world counterparts is not
 * 100% accurate and rather an approximation since there are no official alternative
 * and some of these vehicles are modified that a counterpart does not match exactly.
 * Each entry represents a vehicle brand and its in-game counterpart, along with a list of models.
 * Each model includes its real-world name, in-game alias, style, class, category, and model year information.
 *
 * @remarks
 * - The `brand` is the real-world manufacturer.
 * - The `counterpart` is the in-game equivalent brand name.
 * - The `models` array contains detailed information for each vehicle model.
 * - The `model_year` object contains both the original and alternate (in-game) model year.
 */
export const ERLCVehiclesData: Vehicles.VehicleData[] = [
  {
    brand: "Nissan",
    counterpart: "Navara",
    models: [
      {
        name: "GT-R",
        alias: "Horizon",
        style: "Coupe",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2013",
          alt: "2013",
        },
      },
      {
        name: "Altima",
        alias: "Imperium",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2020",
          alt: "2020",
        },
      },
      {
        name: "Frontier Pro-4X",
        alias: "Boundary",
        style: "Pickup",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "2022",
          alt: "2022",
        },
      },
    ],
  },

  {
    brand: "Dodge",
    counterpart: "Bullhorn",
    models: [
      {
        name: "Ram 1500",
        alias: "BH15",
        style: "Pickup",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "2009",
          alt: "2009",
        },
      },
      {
        name: "Challenger SRT8",
        alias: "Determinator",
        style: "Coupe",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2008",
          alt: "2008",
        },
      },
      {
        name: "Challenger SRT Hellcat",
        alias: "Determinator SFP Fury",
        style: "Coupe",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2015",
          alt: "2022",
        },
      },
      {
        name: "Challenger SRT Hellcat Widebody",
        alias: "Determinator SFP Blackjack Widebody",
        style: "Coupe",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2022",
          alt: "2022",
        },
      },
      {
        name: "Charger SE",
        alias: "Prancer",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2011",
          alt: "2011",
        },
      },
      {
        name: "Charger SXT",
        alias: "Prancer",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2015",
          alt: "2015",
        },
      },
      {
        name: "Charger R/T",
        alias: "Prancer Classic",
        style: "Coupe",
        class: "Car",
        category: "Classic",
        model_year: {
          org: "1969",
          alt: "1969",
        },
      },
      {
        name: "Charger SRT Hellcat",
        alias: "Prancer Widebody",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2020",
          alt: "2020",
        },
      },
      {
        name: "Durango R/T",
        alias: "Pueblo",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2018",
          alt: "2018",
        },
      },
      {
        name: "Diplomat",
        alias: "Foreman",
        style: "Sedan",
        class: "Car",
        category: "Classic",
        model_year: {
          org: "1988",
          alt: "1988",
        },
      },
    ],
  },

  {
    brand: "Audi",
    counterpart: "Averon",
    models: [
      {
        name: "Q8 e-tron",
        alias: "Anodic",
        style: "SUV",
        class: "SUV",
        category: "Electric",
        model_year: {
          org: "2024",
          alt: "2024",
        },
      },
      {
        name: "Q8",
        alias: "Q8",
        style: "SUV",
        class: "SUV",
        category: "Prestige",
        model_year: {
          org: "2022",
          alt: "2022",
        },
      },
      {
        name: "R8 Coupé",
        alias: "R8",
        style: "Coupe",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2017",
          alt: "2017",
        },
      },
      {
        name: "R8 Coupé",
        alias: "RS3",
        style: "Sedan",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2020",
          alt: "2020",
        },
      },
      {
        name: "S5",
        alias: "S5 Cabriolet",
        style: "Coupe",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2010",
          alt: "2010",
        },
      },
    ],
  },

  {
    brand: "BMW",
    counterpart: "BKM",
    models: [
      {
        name: "i8 Roadster",
        alias: "Risen Roadster",
        style: "Convertible",
        class: "SUV",
        category: "Electric",
        model_year: {
          org: "2020",
          alt: "2020",
        },
      },
      {
        name: "X5 M50i",
        alias: "Munich",
        style: "SUV",
        class: "SUV",
        category: "Prestige",
        model_year: {
          org: "2020",
          alt: "2020",
        },
      },
    ],
  },

  {
    brand: "Tesla",
    counterpart: "Celestial",
    models: [
      {
        name: "Model Y",
        alias: "Type-6",
        style: "SUV",
        class: "SUV",
        category: "Electric",
        model_year: {
          org: "2020",
          alt: "2023",
        },
      },
      {
        name: "Cybertruck",
        alias: "Truckatron",
        style: "Pickup",
        class: "Truck",
        category: "Electric",
        model_year: {
          org: "2024",
          alt: "2024",
        },
      },
    ],
  },

  {
    brand: "Mercedes",
    counterpart: "Stuttgart",
    models: [
      {
        name: "Benz C-Class",
        alias: "Executive",
        style: "Sedan",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2021",
          alt: "2021",
        },
      },
      {
        name: "AMG GT",
        alias: "Vierturig",
        style: "Sedan",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2021",
          alt: "2021",
        },
      },
      {
        name: "AMG G63",
        alias: "Landscraft",
        style: "SUV",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2022",
          alt: "2022",
        },
      },
    ],
  },

  {
    brand: "Chevrolet",
    counterpart: "Chevlon",
    models: [
      {
        name: "Camaro SS",
        alias: "Amigo S",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2016",
          alt: "2016",
        },
      },
      {
        name: "Camaro SS",
        alias: "Amigo S",
        style: "Coupe",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2011",
          alt: "2011",
        },
      },
      {
        name: "Camaro ZL1",
        alias: "Amigo LZR",
        style: "Coupe",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2012",
          alt: "2011",
        },
      },
      {
        name: "Impala SS",
        alias: "Antelope",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "1994",
          alt: "1994",
        },
      },
      {
        name: "Tahoe LS 4WD",
        alias: "Camion",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2008",
          alt: "2008",
        },
      },
      {
        name: "Tahoe LT 4WD",
        alias: "Camion",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2002",
          alt: "2002",
        },
      },
      {
        name: "Tahoe RST",
        alias: "Camion",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2018",
          alt: "2018",
        },
      },
      {
        name: "Tahoe 4WD Premier",
        alias: "Camion",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2021",
          alt: "2021",
        },
      },
      {
        name: "Express Cargo 1500",
        alias: "Commuter Van",
        style: "Van",
        class: "Industrial",
        category: "Regular",
        model_year: {
          org: "2006",
          alt: "2006",
        },
      },
      {
        name: "Express Cargo 1500",
        alias: "News Van",
        style: "Van",
        class: "Industrial",
        category: "Regular",
        model_year: {
          org: "2006",
          alt: "2006",
        },
      },
      {
        name: "Corvette C2",
        alias: "Corbeta C2",
        style: "Coupe",
        class: "Car",
        category: "Classic",
        model_year: {
          org: "1967",
          alt: "1967",
        },
      },
      {
        name: "Corvette C7 ZR1",
        alias: "Corbeta RZR",
        style: "Coupe",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2019",
          alt: "2014",
        },
      },
      {
        name: "Corvette C6 Z06",
        alias: "Corbeta X08",
        style: "Coupe",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2013",
          alt: "2014",
        },
      },
      {
        name: "Corvette C8 Z06",
        alias: "Corbeta 8",
        style: "Coupe",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2023",
          alt: "2023",
        },
      },
      {
        name: "Avalanche LT",
        alias: "Landslide",
        style: "Pickup",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "2007",
          alt: "2007",
        },
      },
      {
        name: "Silverado C10",
        alias: "L/M",
        style: "Pickup",
        class: "Truck",
        category: "Classic",
        model_year: {
          org: "1984",
          alt: "1984",
        },
      },
      {
        name: "Silverado 1500 LT",
        alias: "Platoro",
        style: "Pickup",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "2019",
          alt: "2019",
        },
      },
      {
        name: "Step-Van",
        alias: "Food Truck",
        style: "Truck",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "1999",
          alt: "",
        },
      },
      {
        name: "Step-Van",
        alias: "Mail Van",
        style: "Truck",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "1999",
          alt: "",
        },
      },
      {
        name: "K5 Blazer",
        alias: "Inferno",
        style: "SUV",
        class: "SUV",
        category: "Classic",
        model_year: {
          org: "1981",
          alt: "1981",
        },
      },
      {
        name: "C10 Silverado",
        alias: "L/15",
        style: "Pickup",
        class: "Truck",
        category: "Classic",
        model_year: {
          org: "1984",
          alt: "1981",
        },
      },
      {
        name: "K30 Crew Cab",
        alias: "L/35 Extended",
        style: "Pickup",
        class: "Truck",
        category: "Classic",
        model_year: {
          org: "1985",
          alt: "1981",
        },
      },
    ],
  },

  {
    brand: "Ford",
    counterpart: "Falcon",
    models: [
      {
        name: "Mustang Mach-E",
        alias: "eStallion",
        style: "SUV",
        class: "SUV",
        category: "Electric",
        model_year: {
          org: "2021",
          alt: "2024",
        },
      },
      {
        name: "F-150 Lightning",
        alias: "Advance Bolt",
        style: "Pickup",
        class: "Truck",
        category: "Electric",
        model_year: {
          org: "2024",
          alt: "2024",
        },
      },
      {
        name: "F-150",
        alias: "Advance",
        style: "Pickup",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "2018",
          alt: "2018",
        },
      },
      {
        name: "F-150",
        alias: "Advance",
        style: "Pickup",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "2022",
          alt: "2022",
        },
      },
      {
        name: "F-150 Raptor",
        alias: "Advance Beast",
        style: "Pickup",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "2017",
          alt: "2017",
        },
      },
      {
        name: "Fusion",
        alias: "Fission",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2013",
          alt: "2015",
        },
      },
      {
        name: "GT",
        alias: "Heritage",
        style: "Coupe",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2020",
          alt: "2021",
        },
      },
      {
        name: "Crown Victoria",
        alias: "Prime Eques",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2003",
          alt: "2003",
        },
      },
      {
        name: "Crown Victoria",
        alias: "Taxi Sedan Cap",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2003",
          alt: "2003",
        },
      },
      {
        name: "Bronco U725 4-Door",
        alias: "Rampage Beast",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2021",
          alt: "2021",
        },
      },
      {
        name: "Bronco U725 2-Door",
        alias: "Rampage Bigfoot 2-Door",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2021",
          alt: "2021",
        },
      },
      {
        name: "Explorer",
        alias: "Scavenger",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2016",
          alt: "2016",
        },
      },
      {
        name: "Explorer",
        alias: "Taxi SUV Cab",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2016",
          alt: "2016",
        },
      },
      {
        name: "Mustang GT350",
        alias: "Stallion 350",
        style: "Coupe",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2015",
          alt: "2015",
        },
      },
      {
        name: "Shelby Mustang GT350",
        alias: "Stallion 350",
        style: "Coupe",
        class: "Car",
        category: "Classic",
        model_year: {
          org: "1965",
          alt: "1969",
        },
      },
      {
        name: "Expedition XLT",
        alias: "Traveller",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2003",
          alt: "2003",
        },
      },
      {
        name: "Expedition Platinum",
        alias: "Traveller",
        style: "SUV",
        class: "SUV",
        category: "Prestige",
        model_year: {
          org: "2022",
          alt: "2022",
        },
      },
      {
        name: "E-Series Cutaway",
        alias: "Shuttle Bus",
        style: "Bus",
        class: "Industrial",
        category: "Regular",
        model_year: {
          org: "1997",
          alt: "",
        },
      },
      {
        name: "F100",
        alias: "Advance 100 Holiday",
        style: "Pickup",
        class: "Truck",
        category: "Classic",
        model_year: {
          org: "1956",
          alt: "1956",
        },
      },
      {
        name: "Hot Rod",
        alias: "Coupe Hotrod",
        style: "Coupe",
        class: "Car",
        category: "Classic",
        model_year: {
          org: "1932",
          alt: "1934",
        },
      },
    ],
  },

  {
    brand: "Toyota",
    counterpart: "Vellfire",
    models: [
      {
        name: "Tacoma",
        alias: "Evertt Extended Cab",
        style: "Pickup",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "1995",
          alt: "1995",
        },
      },
      {
        name: "Prius XW30",
        alias: "Prima",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2009",
          alt: "2009",
        },
      },
      {
        name: "MR2 W10",
        alias: "Runabout",
        style: "Coupe",
        class: "Car",
        category: "Classic",
        model_year: {
          org: "1984",
          alt: "1984",
        },
      },
      {
        name: "4Runner TRD",
        alias: "Riptide",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2020",
          alt: "2020",
        },
      },
      {
        name: "Tundra SR5",
        alias: "Prairie",
        style: "Pickup",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "2022",
          alt: "2022",
        },
      },
      {
        name: "Supra MK5",
        alias: "Pioneer",
        style: "Coupe",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2019",
          alt: "2019",
        },
      },
      {
        name: "Tacoma TRD Off Road",
        alias: "Everest VRD Max",
        style: "Pickup",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "2023",
          alt: "2023",
        },
      },
    ],
  },

  {
    brand: "Bugatti",
    counterpart: "Strugatti",
    models: [
      {
        name: "Chiron Pur Sport",
        alias: "Ettore",
        style: "Coupe",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2020",
          alt: "2020",
        },
      },
    ],
  },

  {
    brand: "McLaren",
    counterpart: "Surrey",
    models: [
      {
        name: "675LT",
        alias: "650S",
        style: "Coupe",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2016",
          alt: "2016",
        },
      },
    ],
  },

  {
    brand: "Jeep",
    counterpart: "Overland",
    models: [
      {
        name: "Grand Cherokee WK2",
        alias: "Apache",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2011",
          alt: "2011",
        },
      },
      {
        name: "Wrangler JK",
        alias: "Buckaroo",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2006",
          alt: "2018",
        },
      },
      {
        name: "Grand Cherokee WK2",
        alias: "Apache SFP",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2020",
          alt: "2020",
        },
      },
      {
        name: "Jeep Cherokee (XJ)",
        alias: "Apache",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "1984-1996",
          alt: "1995",
        },
      },
    ],
  },

  {
    brand: "Ferrari",
    counterpart: "Maranello",
    models: [
      {
        name: "F8 Tributo",
        alias: "F8",
        style: "Coupe",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2020",
          alt: "2020",
        },
      },
    ],
  },

  {
    brand: "Cadillac",
    counterpart: "Leland",
    models: [
      {
        name: "SLS Chinese",
        alias: "LTS",
        style: "Sedan",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2010",
          alt: "2010",
        },
      },
      {
        name: "Escalade",
        alias: "Vault",
        style: "SUV",
        class: "SUV",
        category: "Prestige",
        model_year: {
          org: "2020",
          alt: "2020",
        },
      },
      {
        name: "CT5-V Blackwing",
        alias: "LTS5-V Blackwing",
        style: "Sedan",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2022",
          alt: "2023",
        },
      },
      {
        name: "Presidential Limousine",
        alias: "Limo",
        style: "Sedan",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2018",
          alt: "2018",
        },
      },
      {
        name: "Fleetwood Krystal Hearse",
        alias: "Birchwood Hearse",
        style: "Hearse",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "1995",
          alt: "1995",
        },
      },
    ],
  },

  {
    brand: "Porsche",
    counterpart: "Ferdinand",
    models: [
      {
        name: "Cayenne Turbo",
        alias: "Jalapeno Turbo",
        style: "SUV",
        class: "SUV",
        category: "Prestige",
        model_year: {
          org: "2022",
          alt: "2022",
        },
      },
    ],
  },

  {
    brand: "Acura",
    counterpart: "Takeo",
    models: [
      {
        name: "NSX",
        alias: "Experience",
        style: "Coupe",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2021",
          alt: "2021",
        },
      },
    ],
  },

  {
    brand: "Honda",
    counterpart: "Elysion",
    models: [
      {
        name: "Civic LX",
        alias: "Slick",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2016",
          alt: "2014",
        },
      },
    ],
  },

  {
    brand: "Pontiac",
    counterpart: "Arrow",
    models: [
      {
        name: "Firebird Trans",
        alias: "Phoenix Nationals",
        style: "Coupe",
        class: "Car",
        category: "Classic",
        model_year: {
          org: "1977",
          alt: "1977",
        },
      },
    ],
  },

  {
    brand: "Chrysler",
    counterpart: "Chryslus",
    models: [
      {
        name: "300C",
        alias: "Champion",
        style: "Sedan",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2005",
          alt: "2005",
        },
      },
    ],
  },

  {
    brand: "Lincoln",
    counterpart: "Sentinel",
    models: [
      {
        name: "Continental",
        alias: "Platinum",
        style: "Sedan",
        class: "Car",
        category: "Classic",
        model_year: {
          org: "1968",
          alt: "1968",
        },
      },
    ],
  },

  {
    brand: "Lamborghini",
    counterpart: "Silhouette",
    models: [
      {
        name: "Aventador",
        alias: "Carbon",
        style: "Coupe",
        class: "Car",
        category: "Prestige",
        model_year: {
          org: "2011",
          alt: "2011",
        },
      },
    ],
  },

  {
    brand: "Land Rover",
    counterpart: "Terrain",
    models: [
      {
        name: "Range Rover Sport",
        alias: "Traveller",
        style: "SUV",
        class: "SUV",
        category: "Prestige",
        model_year: {
          org: "2023",
          alt: "2022",
        },
      },
    ],
  },

  {
    brand: "Cub Cadet",
    counterpart: "Lawn",
    models: [
      {
        name: "XT1",
        alias: "Mower",
        style: "Tractor",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2016",
          alt: "",
        },
      },
    ],
  },

  {
    brand: "Holden",
    counterpart: "Chevlon",
    models: [
      {
        name: "WM Caprice",
        alias: "Captain",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "2006",
          alt: "2006",
        },
      },
    ],
  },

  {
    brand: "Hummer",
    counterpart: "Chevlon",
    models: [
      {
        name: "Hummer H3",
        alias: "Revver",
        style: "SUV",
        class: "SUV",
        category: "Regular",
        model_year: {
          org: "2005",
          alt: "2005",
        },
      },
    ],
  },

  {
    brand: "Mack",
    counterpart: "",
    models: [
      {
        name: "TerraPro",
        alias: "Garbage Truck",
        style: "Truck",
        class: "Industrial",
        category: "Regular",
        model_year: {
          org: "",
          alt: "",
        },
      },
    ],
  },

  {
    brand: "Autocar",
    counterpart: "",
    models: [
      {
        name: "ACX with Heil Half-Pack",
        alias: "Front-Loader Garbage Truck",
        style: "Truck",
        class: "Industrial",
        category: "Regular",
        model_year: {
          org: "2017",
          alt: "",
        },
      },
    ],
  },

  {
    brand: "Westerm Star",
    counterpart: "",
    models: [
      {
        name: "4900 Fuel Tanker",
        alias: "Fuel Tanker",
        style: "Truck",
        class: "Industrial",
        category: "Regular",
        model_year: {
          org: "1998",
          alt: "",
        },
      },
    ],
  },

  {
    brand: "John Deere",
    counterpart: "",
    models: [
      {
        name: "5100M Utility Tractor",
        alias: "Farm Tractor 5100M",
        style: "Truck",
        class: "Industrial",
        category: "Regular",
        model_year: {
          org: "2012",
          alt: "",
        },
      },
    ],
  },

  {
    brand: "International Trucks",
    counterpart: "",
    models: [
      {
        name: "Durastar 4300",
        alias: "Bank Truck",
        style: "Truck",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "2007",
          alt: "",
        },
      },
    ],
  },

  {
    brand: "Can-Am",
    counterpart: "Canyon",
    models: [
      {
        name: "Defender DPS CAB HD9",
        alias: "Descender",
        style: "Truck",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "2023",
          alt: "2023",
        },
      },
    ],
  },

  {
    brand: "Outlander",
    counterpart: "",
    models: [
      {
        name: "800R Can-Am ATV",
        alias: "4-Wheeler",
        style: "Truck",
        class: "Truck",
        category: "Regular",
        model_year: {
          org: "2013",
          alt: "",
        },
      },
    ],
  },

  {
    brand: "Gillig",
    counterpart: "Metro",
    models: [
      {
        name: "BRT Low Floor",
        alias: "Transit Bus",
        style: "Bus",
        class: "Industrial",
        category: "Regular",
        model_year: {
          org: "2005",
          alt: "",
        },
      },
    ],
  },

  {
    brand: "Other",
    counterpart: "",
    models: [
      {
        name: "[N/A]",
        alias: "[N/A]",
        style: "Sedan",
        class: "Car",
        category: "Regular",
        model_year: {
          org: "",
          alt: "",
        },
      },
    ],
  },
];

export default ERLCVehiclesData;
export const AllVehicleModelNames = ERLCVehiclesData.flatMap(({ brand, counterpart, models }) =>
  models.map((model) => FormatVehicleName(model, { name: brand, alias: counterpart }))
);

export const AllVehicleModels = ERLCVehiclesData.flatMap((Brand) =>
  Brand.models.map((Model) => ({ brand: Brand.brand, counterpart: Brand.counterpart, ...Model }))
);
