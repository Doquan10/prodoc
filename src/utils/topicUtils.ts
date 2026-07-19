import type { Topic } from '../types';

export function addTopicToTree(topics: Topic[], parentId: string | null, newTopic: Topic): Topic[] {
  if (parentId === null) return [...topics, newTopic];
  return topics.map(t => {
    if (t.id === parentId) return { ...t, subtopics: [...t.subtopics, newTopic] };
    return { ...t, subtopics: addTopicToTree(t.subtopics, parentId, newTopic) };
  });
}

export function updateTopicInTree(topics: Topic[], id: string, changes: Partial<Omit<Topic, 'subtopics'>>): Topic[] {
  return topics.map(t => {
    if (t.id === id) return { ...t, ...changes };
    return { ...t, subtopics: updateTopicInTree(t.subtopics, id, changes) };
  });
}

export function deleteTopicFromTree(topics: Topic[], id: string): Topic[] {
  return topics
    .filter(t => t.id !== id)
    .map(t => ({ ...t, subtopics: deleteTopicFromTree(t.subtopics, id) }));
}

export function findTopicById(topics: Topic[], id: string): Topic | undefined {
  for (const t of topics) {
    if (t.id === id) return t;
    const found = findTopicById(t.subtopics, id);
    if (found) return found;
  }
  return undefined;
}

export function getAllTopicIds(topic: Topic): string[] {
  return [topic.id, ...topic.subtopics.flatMap(getAllTopicIds)];
}

export function flattenTopics(topics: Topic[], depth = 0): Array<Topic & { depth: number }> {
  return topics.flatMap(t => [{ ...t, depth }, ...flattenTopics(t.subtopics, depth + 1)]);
}
