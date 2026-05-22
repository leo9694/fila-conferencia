module.exports = async (req, res) => {
  res.status(410).json({
    erro: 'Endpoint antigo desativado. Use /api/conferencias, que consulta a API Sankhya sem conexao Oracle direta.'
  });
};
