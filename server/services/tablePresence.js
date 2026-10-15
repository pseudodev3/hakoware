const RECENT = 45000, WRITE_INTERVAL = 20000;
const atTable = (room, userId, now = Date.now()) => Boolean(room?.presence?.[userId] && now - new Date(room.presence[userId]).getTime() < RECENT);
// Only callers that have already authorized room membership may touch a seat.
// The heartbeat never changes the game revision or extends a table's lifetime.
const touchSeat = async (model, room, userId, now = new Date()) => {
  if (!room || !/^[a-f0-9]{24}$/i.test(userId)) return;
  if (room.presence?.[userId] && +now - new Date(room.presence[userId]).getTime() < WRITE_INTERVAL) return;
  const path = `presence.${userId}`;
  await model.updateOne({ _id: room._id, ...(room.members ? { members: userId } : {}), $or: [{ [path]: { $exists: false } }, { [path]: { $lte: new Date(+now - WRITE_INTERVAL) } }] }, { $set: { [path]: now } }, { timestamps: false });
  room.presence = { ...(room.presence || {}), [userId]: now };
};
module.exports = { atTable, touchSeat };
