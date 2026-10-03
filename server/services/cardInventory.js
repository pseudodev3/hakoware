const User = require('../models/User');

// Remove one copy rather than $pull, which would destroy every duplicate.
const removeCard = (cardId, receivedId = null) => [
  {
    $set: {
      inventory: {
        $let: {
          vars: { index: { $indexOfArray: ['$inventory', cardId] } },
          in: {
            $concatArrays: [
              { $slice: ['$inventory', '$$index'] },
              {
                $slice: [
                  '$inventory',
                  { $add: ['$$index', 1] },
                  { $size: '$inventory' },
                ],
              },
              receivedId ? [receivedId] : [],
            ],
          },
        },
      },
      cardDiscoveries: {
        $setUnion: [
          { $ifNull: ['$cardDiscoveries', []] },
          '$inventory',
          receivedId ? [receivedId] : [],
        ],
      },
    },
  },
];
const takeCard = (userId, cardId, session = null, receivedId = null) =>
  User.findOneAndUpdate(
    { _id: userId, inventory: cardId },
    removeCard(cardId, receivedId),
    { returnDocument: 'after', session, updatePipeline: true },
  );
module.exports = { removeCard, takeCard };
