import type { DirectoryEntry, DistributionList, Folder, Message } from '@x400/shared';

export const inlineFolders: Folder[] = [
  { id: 'inbox', name: 'Inbox', unreadCount: 1 },
  { id: 'outbox', name: 'Outbox', unreadCount: 0 },
  { id: 'failed', name: 'Failed', unreadCount: 0 },
  { id: 'archive', name: 'Archive', unreadCount: 0 },
  { id: 'followUp', name: 'Follow-up', unreadCount: 0 },
];

export const inlineMessages: Message[] = [
  {
    envelope: {
      id: '9f2a9f2a-5e51-47f7-a7d8-8a1055b417d8',
      subject: 'Mocked welcome message',
      sender: {
        orName: {
          c: 'DE',
          o: 'Modernization',
          ou: [],
          surname: 'Operator',
        },
        dda: [],
        routingHints: [],
      },
      to: [
        {
          orName: {
            c: 'DE',
            o: 'Modernization',
            ou: [],
            surname: 'Operator',
          },
          dda: [],
          routingHints: [],
        },
      ],
      cc: [],
      bcc: [],
      priority: 'normal',
      sensitivity: 'normal',
      folder: 'inbox',
      status: 'delivered',
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T10:00:00.000Z',
      messageId: '<welcome@modernized.x400>',
    },
    content: {
      text: 'This payload is used by automated tests to simulate reading a message.',
      attachments: [],
    },
    reports: [
      {
        id: 'f73ef0b5-d151-4ba9-a644-1ad3fd75c392',
        messageId: '9f2a9f2a-5e51-47f7-a7d8-8a1055b417d8',
        type: 'delivery',
        timestamp: '2024-01-01T10:00:10.000Z',
        recipient: {
          orName: {
            c: 'DE',
            o: 'Modernization',
            ou: [],
            surname: 'Operator',
          },
          dda: [],
          routingHints: [],
        },
      },
      {
        id: '1c52f102-5b26-4bad-8f49-0c694b42df35',
        messageId: '9f2a9f2a-5e51-47f7-a7d8-8a1055b417d8',
        type: 'read',
        timestamp: '2024-01-01T10:02:00.000Z',
        recipient: {
          orName: {
            c: 'DE',
            o: 'Modernization',
            ou: [],
            surname: 'Operator',
          },
          dda: [],
          routingHints: [],
        },
      },
    ],
  },
];

export const inlineDirectoryEntries: DirectoryEntry[] = [
  {
    id: 'ops-centre',
    displayName: 'Operations Centre',
    rfc822: 'ops.centre@example.test',
    orAddress: 'C=DE;A=MODERNIZATION;P=OPS;O=Operations;S=Centre',
    attributes: {
      department: 'Operations',
      telephoneNumber: '+49 30 1234 5000',
    },
  },
  {
    id: 'modernization-lead',
    displayName: 'Modernization Lead',
    rfc822: 'lead@modernization.example',
    orAddress: 'C=DE;A=MODERNIZATION;P=HQ;O=Modernization;S=Lead',
    attributes: {
      department: 'Programme Office',
      telephoneNumber: '+49 30 1234 5001',
    },
  },
  {
    id: 'support-desk',
    displayName: 'Support Desk',
    rfc822: 'support.desk@example.test',
    orAddress: 'C=DE;A=MODERNIZATION;P=SUPPORT;O=Support;S=Desk',
    attributes: {
      department: 'Support',
      telephoneNumber: '+49 30 1234 5010',
    },
  },
];

export const inlineDistributionLists: DistributionList[] = [
  {
    id: 'modernization-team',
    name: 'Modernization Team',
    members: ['ops-centre', 'modernization-lead', 'support-desk'],
  },
];
