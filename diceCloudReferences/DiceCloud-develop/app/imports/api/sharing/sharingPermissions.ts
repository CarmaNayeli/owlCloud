import { includes } from 'lodash';
import { fetchDocByRef } from '/imports/api/parenting/parentingFunctions';
import type { Shared } from '/imports/api/sharing/SharingSchema';
import type { TreeDoc } from '/imports/api/parenting/ChildSchema';

function assertIdValid(userId: string | undefined | null): asserts userId {
  if (!userId || typeof userId !== 'string') {
    throw new Meteor.Error('Permission denied',
      'No user ID. Are you logged in?');
  }
}

function assertDocExists(doc: Record<string, any> | undefined): asserts doc {
  if (!doc) {
    throw new Meteor.Error('Permission denied',
      'Permission denied: No such document exists');
  }
}

export function assertOwnership(doc: Shared, userId: string): asserts doc {
  assertIdValid(userId);
  assertDocExists(doc);

  if (doc.owner === userId) {
    return;
  } else {
    throw new Meteor.Error('Permission denied',
      'You are not the owner of this document');
  }
}

/**
 * Assert that the user can edit the root document which manages its own sharing
 * permissions.
 *
 * Warning: the doc and userId must be set by a trusted source
 */
export function assertEditPermission(doc: Shared | undefined, userId: string | undefined | null): asserts doc {
  assertIdValid(userId);
  assertDocExists(doc);
  const user = Meteor.users.findOne(userId, {
    fields: {
      'roles': 1,
    }
  });
  if (!user) {
    throw new Meteor.Error('Edit permission denied',
      'No such user exists');
  }

  // Admin override
  if (user.roles && user.roles.includes('admin')) {
    return;
  }

  // Ensure the user is authorized for this specific document
  if (
    doc.owner === userId ||
    includes(doc.writers, userId)
  ) {
    return;
  } else {
    throw new Meteor.Error('Edit permission denied',
      'You do not have permission to edit this document');
  }
}

/**
 * Assert that the user can edit the root document which manages its own sharing
 * permissions.
 *
 * Warning: the doc and userId must be set by a trusted source
 */
export function assertCopyPermission(doc: Shared, userId): asserts doc {
  assertIdValid(userId);
  assertDocExists(doc);
  const user = Meteor.users.findOne(userId, {
    fields: {
      'roles': 1,
    }
  });

  if (!user) {
    throw new Meteor.Error('Edit permission denied',
      'No such user exists');
  }

  // Admin override
  if (user.roles && user.roles.includes('admin')) {
    return;
  }

  // Ensure the user is authorized for this specific document
  if (
    doc.owner === userId ||
    includes(doc.writers, userId)
  ) {
    return;
  } else if (
    (includes(doc.readers, userId) || doc.public) &&
    doc.readersCanCopy
  ) {
    return;
  } else {
    throw new Meteor.Error('Copy permission denied',
      'You do not have permission to copy this document');
  }
}

function getRoot(doc: TreeDoc | Shared | undefined) {
  assertDocExists(doc);
  if ('root' in doc) {
    return fetchDocByRef<Shared>(doc.root);
  } else {
    return doc;
  }
}

/**
 * Assert that the user can edit a descendant document whose root ancestor
 * implements sharing permissions.
 *
 * Warning: the doc and userId must be set by a trusted source
 */
export function assertDocEditPermission(doc: TreeDoc | Shared | undefined, userId: string | null): asserts doc {
  const root = getRoot(doc);
  assertEditPermission(root, userId);
}

/**
 * Assert that the user can copy a descendant document whose root ancestor
 * implements sharing permissions.
 *
 * Warning: the doc and userId must be set by a trusted source
 */
export function assertDocCopyPermission(doc, userId): asserts doc {
  const root = getRoot(doc);
  assertCopyPermission(root, userId);
}

export function assertViewPermission(doc, userId): asserts doc {
  assertDocExists(doc);
  if (doc.public) return;
  assertIdValid(userId);

  if (
    doc.owner === userId ||
    includes(doc.readers, userId) ||
    includes(doc.writers, userId)
  ) {
    return;
  } else {

    // Admin override
    const user = Meteor.users.findOne(userId, {
      fields: {
        'roles': 1,
      }
    });
    if (!user) {
      throw new Meteor.Error('Edit permission denied',
        'No such user exists');
    }

    if (user.roles && user.roles.includes('admin')) {
      return;
    }

    throw new Meteor.Error('View permission denied',
      'You do not have permission to view this document');
  }
}

/**
 * Assert that the user can view a descendant document whose root ancestor
 * implements sharing permissions.
 *
 * Warning: the doc and userId must be set by a trusted source
 */
export function assertDocViewPermission(doc, userId): asserts doc {
  const root = getRoot(doc);
  assertViewPermission(root, userId);
}

export function assertAdmin(userId): asserts userId {
  assertIdValid(userId);
  const user = Meteor.users.findOne(userId, { fields: { roles: 1 } });
  if (!user) {
    throw new Meteor.Error('Permission denied',
      'UserId does not match any existing user');
  }
  const isAdmin = user.roles && user.roles.includes('admin')
  if (!isAdmin) {
    throw new Meteor.Error('Permission denied',
      'User does not have the admin role');
  }
}
