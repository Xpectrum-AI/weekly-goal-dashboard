import type { Person } from "./types";
import { norm, descendantNames, isTopLeader } from "./org";

// ───────────────────────────────────────────────────────────────────────────
// Hierarchy-based permissions.
//
// Controls what data a logged-in employee can see/modify based on their
// position in the org tree.
//
// Level definitions:
//   1 – Founder / CEO: full visibility
//   2 – Executive Leadership: all employees below them
//   3 – Department Heads: their department hierarchy
//   4 – Team Leads: their team
//   5 – Employees: only their own data
// ───────────────────────────────────────────────────────────────────────────

/**
 * Get the effective level for a person.
 * Falls back to computing from teamLead chain if not stored.
 */
export function getEffectiveLevel(person: Person): number {
  if (typeof person.level === "number") return person.level;
  if (!person.teamLead || isTopLeader(person)) return 1;
  return 5; // default to lowest visibility
}

/**
 * Levels 4–5 (team leads and employees) can only ever see and edit their own
 * data — not their team's. Levels 1–3 keep hierarchy-wide visibility.
 */
export function isSelfOnly(viewer: Person): boolean {
  return getEffectiveLevel(viewer) >= 4;
}

/**
 * Get the set of person IDs that a viewer can see.
 * Uses the descendant tree from the org module.
 */
export function getVisiblePeopleIds(
  viewer: Person,
  allPeople: Person[]
): Set<string> {
  const level = getEffectiveLevel(viewer);

  // Level 1 (CEO) sees everyone
  if (level === 1 || isTopLeader(viewer)) {
    return new Set(allPeople.map((p) => p._id));
  }

  // Levels 4–5 see only themselves
  if (isSelfOnly(viewer)) {
    return new Set([viewer._id]);
  }

  // Everyone else sees their descendant tree
  const names = descendantNames(allPeople, viewer.name);
  return new Set(
    allPeople.filter((p) => names.has(norm(p.name))).map((p) => p._id)
  );
}

/**
 * Get the set of normalized names that a viewer can see.
 */
export function getVisibleNames(
  viewer: Person,
  allPeople: Person[]
): Set<string> {
  const level = getEffectiveLevel(viewer);

  if (level === 1 || isTopLeader(viewer)) {
    return new Set(allPeople.map((p) => norm(p.name)));
  }

  // Levels 4–5 see only themselves
  if (isSelfOnly(viewer)) {
    return new Set([norm(viewer.name)]);
  }

  return descendantNames(allPeople, viewer.name);
}

/**
 * Check if a viewer can see a specific person.
 */
export function canViewPerson(
  viewer: Person,
  target: Person,
  allPeople: Person[]
): boolean {
  // Everyone can see themselves
  if (viewer._id === target._id) return true;

  const visibleIds = getVisiblePeopleIds(viewer, allPeople);
  return visibleIds.has(target._id);
}

/**
 * Check if a viewer can manage (edit/deactivate) a specific person.
 * A user can manage people below them in the hierarchy.
 */
export function canManagePerson(
  viewer: Person,
  target: Person,
  allPeople: Person[]
): boolean {
  // Cannot manage yourself (prevents self-deactivation etc.)
  if (viewer._id === target._id) return false;

  const viewerLevel = getEffectiveLevel(viewer);
  const targetLevel = getEffectiveLevel(target);

  // Must be higher in the org (lower level number)
  if (viewerLevel >= targetLevel) return false;

  // Must be in the viewer's sub-tree
  return canViewPerson(viewer, target, allPeople);
}

/**
 * Check if a viewer can invite new employees.
 * Only levels 1-3 (leadership) can invite.
 */
export function canInviteEmployee(viewer: Person): boolean {
  return getEffectiveLevel(viewer) <= 3;
}

/**
 * Filter a list of people to only those visible to the viewer.
 */
export function filterVisiblePeople(
  viewer: Person,
  people: Person[],
  allPeople: Person[]
): Person[] {
  const visibleIds = getVisiblePeopleIds(viewer, allPeople);
  return people.filter((p) => visibleIds.has(p._id));
}

/**
 * Filter submissions (or any rows with personName) to the viewer's scope.
 */
export function filterVisibleByName<T extends { personName: string }>(
  viewer: Person,
  rows: T[],
  allPeople: Person[]
): T[] {
  const names = getVisibleNames(viewer, allPeople);
  return rows.filter((r) => names.has(norm(r.personName)));
}
