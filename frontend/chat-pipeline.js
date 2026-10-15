(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChatPipeline = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function id(value) {
    if (value === '' || value == null || typeof value === 'boolean') return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }

  function matches(conversation = {}, pipelineId = '', scope = 'all') {
    if (pipelineId === '' || pipelineId == null) return true;
    const categoryId = id(pipelineId);
    if (categoryId === null) return false;
    const bitrix = conversation.bitrix || {};
    const links = scope === 'history' ? (bitrix.history || [])
      : scope === 'current' ? (bitrix.pipelines || [])
        : [...(bitrix.pipelines || []), ...(bitrix.history || [])];
    return links.some((link) => id(link.categoryId) === categoryId);
  }

  function options(pipelines = [], records = []) {
    const values = new Map();
    const links = records.flatMap((record) => [...(record.bitrixPipelines || []), ...(record.bitrixPipelineHistory || [])]);
    for (const item of [...links, ...pipelines]) {
      const categoryId = id(item.categoryId);
      if (categoryId !== null) values.set(categoryId, { categoryId, name: item.name || item.categoryName || `Pipeline ${categoryId}` });
    }
    return [...values.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  return { id, matches, options };
}));
