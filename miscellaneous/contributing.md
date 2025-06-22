---
description: >-
  Detailed instructions on how to submit bug reports, feature requests, and
  changes or improvements to the project.
icon: wand-magic-sparkles
---

# Contributing

## Submitting Reports and Suggestions

***

### Bugs Reports

If you encounter a bug or an issue, please open a detailed report on the GitHub repository. A bug report should include the following details:

* Steps to reproduce the bug;
* Expected behavior;
* Actual behavior;
* Any error messages or logs.

### Feature Requests

We welcome any suggestions for new features or improvements to make. Share your ideas for new features or improvements by opening an issue. A feature request shall describe:

* The problem you're trying to solve or the specific need to be fulfied;
* The proposed solution or implementation logic;
* Any potential benefits and drawbacks.

{% hint style="info" %}
Be precise about the proposed outcome of the feature and how it relates to existing features. Include implementation details if possible.
{% endhint %}

## Submitting Changes and Improvements

***

All changes and improvements contributions must be submitted as regular pull requests. Steps include:

* Fork the repository and create a pull request for your changes.
* Follow these coding guidelines:
  * Pascal case for functions, arguments, and variables (with cetain exceptions)
  * Self-explanatory and well-documented names
  * Include relative tests to the changes/additions if possible
    * Passing linting and style checks (see `eslint.config.mjs` and `.prettierrc.json`)
* Write clear and concise commit messages.
* Reference the relevant issue(s) in your pull request.

### General Tips and Notes to Consider

* **Smaller is better**\
  Submit **one** pull request per bug fix or feature. A pull request should contain isolated changes pertaining to a single bug fix or feature implementation. **Do not** refactor or reformat code that is unrelated to your change. It is better to **submit many small pull requests** rather than a single large one. Enormous pull requests will take enormous amounts of time to review, or may be rejected altogether.
*   **Coordinate bigger changes**

    For large and non-trivial changes, open an issue to discuss a strategy with the maintainers. Otherwise, you risk doing a lot of work for nothing!
*   **Prioritize understanding over cleverness**

    Write code clearly and concisely. Remember that source code usually gets written once and read often. Ensure the code is clear to the reader. The purpose and logic should be obvious to a reasonably skilled developer, otherwise you should add a comment that explains it.
*   **Follow existing coding style and conventions**

    Keep your code consistent with the style, formatting, and conventions in the rest of the code base. When possible, these will be enforced with a linter. Consistency makes it easier to review and modify in the future.
* **Include test coverage when applicable**\
  Add unit tests or UI tests when possible. Follow existing patterns for implementing tests.
*   **Promptly address any CI failures**

    If your pull request fails to build or pass tests, please push another commit to fix it.
* **When writing comments, use properly constructed sentences, including punctuation.**

## A Final Note

***

Feature requests, improvement requests, or bug reports can be submitted through any of the following methods:

1. Opening an issue on the application's [GitHub repository](https://github.com/EgizianoEG/LAPD-Central-Bot/issues) <mark style="color:blue;">(Recommended)</mark>
2. Opening a ticket or thread on the application's [support server](https://discord.gg/B2qMTjqgPK)
3. Contacting a current developer of the application



**Thank you for considering contributing to this project!**
