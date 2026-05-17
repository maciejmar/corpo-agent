const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'changeme-set-JWT_SECRET-env');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
