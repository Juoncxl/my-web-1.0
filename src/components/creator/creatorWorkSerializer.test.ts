import { describe, expect, it } from 'vitest';
import type { Asset } from '../../types';
import { createBlankCreatorWorkDraft } from './CreatorWorkWorkspace';
import { addCollabParticipant, createBlankCollabParticipant, createPublicCollaborationSnapshot } from './creatorCollabModel';
import { createPublicAssetExport, serializeCreatorWorkDraft } from './creatorWorkSerializer';

function serialize(overrides: Partial<ReturnType<typeof createBlankCreatorWorkDraft>> = {}) {
  const draft = { ...createBlankCreatorWorkDraft(), ...overrides };
  return serializeCreatorWorkDraft({
    ...draft,
    imagePromptToolModel: draft.contentCanvas.imagePrompt.toolModel
  });
}

describe('Creator Work canonical serializer', () => {
  it('persists standard presentation metadata and one optional Collaboration link', () => {
    const result = serialize({
      title: ' งานทั่วไป ',
      contentTypes: ['character', 'lore'],
      appPlatforms: ['Doki Chat'],
      audienceRating: '13_plus',
      contentWarnings: ['ความรุนแรง'],
      genres: ['แฟนตาซี'],
      collaborationAssetId: 'collab-owned-1'
    });

    expect(result).toMatchObject({
      title: 'งานทั่วไป',
      category: 'character',
      collaboration: null,
      publicCollaboration: null,
      collaborationAssetId: 'collab-owned-1',
      contentTypes: ['character', 'lore'],
      presentationMetadata: {
        contentTypes: ['character', 'lore'],
        appPlatforms: ['Doki Chat'],
        audienceRating: '13_plus',
        contentWarnings: ['ความรุนแรง'],
        genres: ['แฟนตาซี']
      }
    });
  });

  it('uses the Collaboration name as the card title and keeps contacts private', () => {
    const privateCollaboration = addCollabParticipant(
      {
        ...createBlankCreatorWorkDraft().collaboration,
        name: ' Project Aurora ',
        sharedTag: '#aurora',
        visibilityPolicy: {
          showParticipantStatuses: false,
          showParticipantNotes: false,
          showParticipantDeadlineOverrides: false
        }
      },
      createBlankCollabParticipant({
        id: 'person-1',
        creatorName: 'Partner',
        contact: 'https://private.example/contact',
        notes: 'private note',
        dataStatus: 'approved'
      })
    );
    const result = serialize({ workMode: 'collab', title: 'ignored title', collaboration: privateCollaboration });

    expect(result.title).toBe('Project Aurora');
    expect(result.category).toBe('collab');
    expect(result.collaboration?.participants[0].contact).toContain('private.example');
    expect(JSON.stringify(result.publicCollaboration)).not.toContain('private.example');
    expect(result.publicCollaboration?.participants[0]).not.toHaveProperty('notes');
    expect(result.publicCollaboration?.participants[0]).not.toHaveProperty('dataStatus');
  });

  it('publishes optional management groups only when their switches are enabled', () => {
    const draft = addCollabParticipant(
      {
        ...createBlankCreatorWorkDraft().collaboration,
        visibilityPolicy: {
          showParticipantStatuses: true,
          showParticipantNotes: true,
          showParticipantDeadlineOverrides: true
        }
      },
      createBlankCollabParticipant({
        creatorName: 'Partner',
        contact: '@never-public',
        notes: 'public promo note',
        dataStatus: 'approved',
        imageStatus: 'reviewing',
        useDeadlineOverrides: true,
        deadlineOverrides: { data: '2026-10-10' }
      })
    );
    const snapshot = createPublicCollaborationSnapshot(draft);

    expect(snapshot.participants[0]).toMatchObject({
      notes: 'public promo note',
      dataStatus: 'approved',
      imageStatus: 'reviewing',
      deadlineOverrides: { data: '2026-10-10' }
    });
    expect(JSON.stringify(snapshot)).not.toContain('@never-public');
  });

  it('removes the private Collaboration draft from public JSON exports', () => {
    const asset = {
      id: 'collab-1', userId: 'owner-1', authorName: 'Owner', title: 'Collab',
      icon: { type: 'emoji', value: '🤝' }, category: 'collab', content: '', isPublic: true,
      visibility: 'public', status: 'finished', createdAt: '2026-09-05T00:00:00.000Z', updatedAt: '2026-09-05T00:00:00.000Z',
      collaboration: { ...createBlankCreatorWorkDraft().collaboration, participants: [createBlankCollabParticipant({ contact: '@secret' })] },
      publicCollaboration: createPublicCollaborationSnapshot(createBlankCreatorWorkDraft().collaboration)
    } satisfies Asset;

    const exported = createPublicAssetExport(asset);
    expect(exported).not.toHaveProperty('collaboration');
    expect(JSON.stringify(exported)).not.toContain('@secret');
  });
});
