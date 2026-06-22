// Deliberate violation: lodash import.
import { map, filter } from 'lodash';

export function activeUsers(users: { name: string; active: boolean }[]) {
  return map(filter(users, 'active'), 'name');
}