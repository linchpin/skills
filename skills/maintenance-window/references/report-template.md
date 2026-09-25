# Maintenance report — task comment template

Post this as one comment on the period's maintenance task. How to post it, and what status to
set, is [`task-tracking`](../../task-tracking/SKILL.md)'s call.

Write it for someone who wasn't there: the account manager answering the client, or next
month's pass. Every PR it mentions gets a link. Leave out any section that's empty, and don't
write "none".

```markdown
## Maintenance — <site>, <YYYY-MM>

**Window:** <maintenance/YYYY-MM> → merged in <PR link> (<merge commit | rebase merge>)
**Routing:** <hybrid | window | direct> · **Verified:** <gates + build + smoke/E2E> · <staging QA: pages checked | no staging>

### Updated
| Group | Changes |
| --- | --- |
| WordPress plugins | akismet 5.2 => 5.3, … |
| Composer | … |
| npm | … |
| Lock files | refreshed |

### Security
- <package> <old> => <new> — <advisory id>, shipped ahead of the batch in <PR link>

### Majors
| Update | Outcome |
| --- | --- |
| @wordpress/scripts 35 => 36 | merged in <PR link> |
| phpcs 3 => 4 | held: <why>; revisit when <condition> |

### Closed without merging
- <PR links> — <why: duplicate of …, already on main, superseded by …>

### Pipeline findings
- <finding id> — <one line>; fix in <PR or task link>

### Needs a decision
- <anything a person has to choose: a floor raise, a paid-plugin renewal, a held major>
```

The rules that make it useful:

- **The version lines use `old => new`,** matching the commit bodies that `renovatebot-config`
  emits, so the report and the changelog read the same way.
- **Name the reason for every hold.** Say what would have to change for it to be revisited. A
  hold with no reason gets re-litigated every month.
- **"Needs a decision" is for the user or the client.** It's never for work you could have
  done yourself.
- **Keep the status honest.** A merged window is *in review* until a deploy has been observed.
