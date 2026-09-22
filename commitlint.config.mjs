/**
 * Conventional Commits, with the @commitlint/config-conventional defaults left untouched.
 *
 * The defaults were checked against this repository's own history before being adopted:
 * no existing commit body line exceeds 100 characters, so body-max-line-length and
 * footer-max-line-length are satisfied as they come. If a future evidence block ever needs
 * a longer line, wrap the line — do not weaken the rule to fit one commit.
 *
 * Merging is squash-only, so the pull request title is what becomes the commit subject on
 * main. That is why CI lints the title and not the branch commits.
 */
export default {
  extends: ['@commitlint/config-conventional'],
};
