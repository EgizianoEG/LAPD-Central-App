# LAPD Central Discord App

[![Tests & Code Lint Status](https://github.com/EgizianoEG/LAPD-Central-App/actions/workflows/RunTests.yml/badge.svg?branch=main)](https://github.com/EgizianoEG/LAPD-Central-App/actions/workflows/RunTests.yml "Tests & Code Lint Status")
[![CodeFactor](https://www.codefactor.io/repository/github/egizianoeg/lapd-central-app/badge)](https://www.codefactor.io/repository/github/egizianoeg/lapd-central-app)
[![License: MIT](https://img.shields.io/github/license/EgizianoEG/LAPD-Central-App?label=License&color=sandybrown)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/github/package-json/v/EgizianoEG/LAPD-Central-App/main?filename=package.json&label=Version&color=blue)](https://github.com/EgizianoEG/LAPD-Central-App/releases/)
[![App Uptime](https://uptime.betterstack.com/status-badges/v1/monitor/10ynq.svg)](https://uptime.betterstack.com/?utm_source=status_badge)

A feature-rich, easy-to-understand Discord application built with [discord.js](https://github.com/discordjs/discord.js) for ER:LC LAPD roleplay communities.

## How the Project Came About

This Discord application was developed to serve and enhance ER:LC LAPD roleplay community by providing robust utility commands and management modules.

## The Motivation

Created to address several community needs, including:
- Implementation of commonly wanted features, including roleplay specific ones, in one place;
- Improved UI and UX over existing solutions;
- Comprehensive roleplay management tools; and
- Open-source alternative to closed systems.

## Documentation

[See the GitBook documentation page](https://lapd-central-app.gitbook.io/documentation).

## Contributing

Refer to the [Contribution Guide](https://github.com/EgizianoEG/LAPD-Central-App/blob/main/CONTRIBUTING.md) for further details.

### Prerequisites

- Node.js version 24.1.0 or higher
- npm version 11.2.0 or higher
- MongoDB database user (cloud)
- Discord App (i.e. bot) Token

### Installation

1. Clone the repository and navigate to the project directory
2. Install dependencies: `npm install`
3. Copy configuration template or rename it: `cp ./Source/Config/Secrets.example.ts ./Source/Config/Secrets.ts`
4. Configure your credentials in `Secrets.ts` or use environment variables (Some are prefilled and do not need to be changed like spreadsheet Id)
5. Start development process (i.e. running the application): `npm run start`


### Configuration

The application requires several configuration values:
- **Discord**: Bot token, guild related settings
- **MongoDB**: Database connection string along with database user credentials
- **Roblox**: API integration for username lookups preventing harsh ratelimits
- **Google**: Service account for spreadsheet generation (optional)

## License

This project/app/bot is licensed under the terms of the [MIT license](https://github.com/EgizianoEG/LAPD-Central-App/blob/main/LICENSE.md), which allows for free use, distribution, and modification of the code as long as the original copyright and license notice are included.
