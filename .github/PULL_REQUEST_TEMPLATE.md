# Pull Request Template

<!--
  PR Title Convention:
  Please use Conventional Commits for your PR title.
  Format: <type>[+<type>...](<scope>): <description>

  Examples:
  - feat(auth): add Google OAuth login
  - fix(button): prevent multiple clicks on shift button
  - docs(readme): update setup instructions
  - refactor+perf(database): optimize shift query performance
  - fix+chore(auth): patch token bug and update deps

  Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
  Notes:
  - Multiple types are allowed; separate them with '+' (e.g., "feat+fix(scope): ...").
  - Scope is optional. Keep the description short and imperative.
-->

## Description & Motivation
<!-- Describe your changes in detail -->

## Related Issue or Benefits
<!-- Link to the issue this PR addresses, or state the benefits this PR would introduce -->

## Migration / Breaking Changes (if applicable)
<!-- If your change includes a breaking change, please describe the migration steps or any necessary actions for users (or developers) to take when updating to this version. -->

## Screenshots (if applicable)
<!-- Add screenshots to demonstrate the changes, before and after, if applicable -->

## How to Test (if applicable)
<!-- Please describe the steps to reproduce/verify the changes manually. -->
1. 
2. 
3. 

## Type of Change
<!-- Please delete options that are not relevant. -->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactor (code improvement with no functionality change)
- [ ] Documentation update

## Checklist

- [ ] The code follows the project's style guidelines and contributing guidelines
- [ ] I have performed a self-review of my code
- [ ] I have added tests that prove my fix is effective or that my feature works, if applicable and possible
- [ ] New and existing unit tests pass locally with my changes
- [ ] I have updated the documentation accordingly, if and where necessary
