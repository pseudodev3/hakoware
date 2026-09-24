const ContractMoment = require('../models/ContractMoment');
const ContractEvent = require('../models/ContractEvent');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Friendship = require('../models/Friendship');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const MOMENT_OPEN_MS = 12 * HOUR;
const RESOLVED_VISIBLE_MS = 6 * HOUR;
const MOMENT_ORDER = Object.freeze(['HOT_SEAT', 'SPLIT_DECISION', 'DOUBLE_DARE']);

const HOT_SEAT_PROMPTS = Object.freeze([
  { id: 'pretend-not-care', text: 'If this contract vanished tonight, who would pretend not to care?', options: ['Me', 'Them', 'Both of us', 'Neither of us'] },
  { id: 'dry-reply-power', text: "Who has more power to ruin the other's mood with one dry reply?", options: ['Me', 'Them', 'Both of us', 'Neither of us'] },
  { id: 'argument-fold', text: 'Who would fold first after a serious argument?', options: ['Me', 'Them', 'Both at once', 'Nobody'] },
  { id: 'distant-first', text: 'Who notices first when the other starts acting distant?', options: ['Me', 'Them', 'Both instantly', 'Neither'] },
  { id: 'jealous-normal', text: 'Who is more likely to get jealous and act completely normal?', options: ['Me', 'Them', 'Both of us', 'Nobody admits it'] },
  { id: 'reply-cares', text: 'Who secretly cares more about getting a reply?', options: ['Me', 'Them', 'Same energy', 'Neither'] },
  { id: 'done-text-first', text: "Who would text first after saying “I'm done”?", options: ['Me', 'Them', 'Both fold', 'Nobody'] },
  { id: 'unbothered-act', text: 'Who is better at pretending they are unbothered?', options: ['Me', 'Them', 'Both are frauds', 'Neither'] },
  { id: 'week-disappear', text: 'Who would take it more personally if the other disappeared for a week?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'one-word-overthink', text: 'Who is more likely to overthink a one-word reply?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'energy-shift', text: "Who notices immediately when the other's energy changes?", options: ['Me', 'Them', 'Both instantly', 'Neither'] },
  { id: 'cares-contract', text: 'Who actually cares more about keeping this contract alive?', options: ['Me', 'Them', 'Same energy', 'Ask us tomorrow'] },
  { id: 'double-text', text: 'Who is more likely to double-text and then regret it?', options: ['Me', 'Them', 'Both of us', 'Never happening'] },
  { id: 'left-on-read', text: 'Who takes being left on read more personally?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'story-view', text: "Who would notice first if the other stopped viewing their stories?", options: ['Me', 'Them', 'Both instantly', 'Neither'] },
  { id: 'old-chat-reread', text: 'Who is more likely to reread old chats when the vibe feels off?', options: ['Me', 'Them', 'Both of us', 'Nobody'] },
  { id: 'fake-fine', text: 'Who says “I’m fine” while very obviously not being fine?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'apology-first', text: 'Who is more likely to apologize first even when they still think they were right?', options: ['Me', 'Them', 'Both sometimes', 'Neither folds'] },
  { id: 'petty-memory', text: 'Who remembers tiny offenses for way too long?', options: ['Me', 'Them', 'Both keep receipts', 'Neither'] },
  { id: 'attention-hungry', text: 'Who secretly wants more attention than they admit?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'punctuation-overthink', text: 'Who is more likely to overthink a period at the end of a text?', options: ['Me', 'Them', 'Both of us', 'Absolutely neither'] },
  { id: 'energy-match', text: 'Who mirrors the other person’s energy faster?', options: ['Me', 'Them', 'Both instantly', 'Neither'] },
  { id: 'no-contact-break', text: 'Who would break a fake “no contact” first?', options: ['Me', 'Them', 'Both fold', 'Nobody'] },
  { id: 'muted-story', text: 'Who would be more offended to find out they got muted?', options: ['Me', 'Them', 'Both of us', 'Would not care'] },
  { id: 'screenshot-chat', text: 'Who is more likely to screenshot a conversation and send it to a friend?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'tone-detective', text: 'Who notices a tiny change in texting tone first?', options: ['Me', 'Them', 'Both instantly', 'Neither'] },
  { id: 'jealous-denial', text: 'Who would deny being jealous even with obvious evidence?', options: ['Me', 'Them', 'Both of us', 'Nobody'] },
  { id: 'soft-block', text: 'Who is more likely to mute instead of saying they are annoyed?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'miss-first', text: 'After a few quiet days, who misses the other first?', options: ['Me', 'Them', 'Same time', 'Nobody admits it'] },
  { id: 'care-reveal', text: 'Who would be more embarrassed if the other knew how much they actually cared?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'status-check', text: 'Who is more likely to check if the other is online after getting ignored?', options: ['Me', 'Them', 'Both of us', 'Never'] },
  { id: 'bad-mood-transfer', text: 'Who can accidentally ruin the other person’s mood faster?', options: ['Me', 'Them', 'Equal damage', 'Neither'] },
  { id: 'last-seen', text: 'Who would notice the other person’s “last seen” changing first?', options: ['Me', 'Them', 'Both instantly', 'Neither'] },
  { id: 'silent-treatment', text: 'Who is worse at pretending the silent treatment is not bothering them?', options: ['Me', 'Them', 'Both are terrible', 'Neither'] },
  { id: 'compliment-memory', text: 'Who remembers one random compliment for months?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'first-to-call', text: 'If texting suddenly stopped working, who would call first?', options: ['Me', 'Them', 'Both at once', 'Nobody'] },
  { id: 'secret-soft', text: 'Who is secretly softer than they act?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'read-between-lines', text: 'Who reads between the lines even when there are no lines to read between?', options: ['Me', 'Them', 'Both overthink', 'Neither'] },
  { id: 'grudge-duration', text: 'Who can stay annoyed longer without saying why?', options: ['Me', 'Them', 'Both can drag it', 'Neither'] },
  { id: 'attention-test', text: 'Who is more likely to go quiet just to see if the other notices?', options: ['Me', 'Them', 'Both of us', 'Never'] },
  { id: 'replace-jealousy', text: 'Who would take it harder if the other suddenly got very close to someone new?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'unsent-message', text: 'Who has probably typed something dramatic and deleted it before sending?', options: ['Me', 'Them', 'Both of us', 'Nobody'] },
  { id: 'too-fast-attachment', text: 'Who got emotionally invested faster than they would admit?', options: ['Me', 'Them', 'Same pace', 'Neither'] },
  { id: 'one-more-chance', text: 'Who gives “one more chance” more easily?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'call-out-distance', text: 'Who is more likely to call out the distance instead of pretending everything is normal?', options: ['Me', 'Them', 'Both eventually', 'Neither'] },
  { id: 'memory-details', text: 'Who remembers tiny details the other forgot they even mentioned?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'public-private', text: 'Who acts more casual in public than they do in private?', options: ['Me', 'Them', 'Both of us', 'Neither'] },
  { id: 'ghosting-panic', text: 'If one of you vanished for 24 hours with no warning, who spirals first?', options: ['Me', 'Them', 'Both of us', 'Nobody'] }
]);

const SPLIT_DECISION_PROMPTS = Object.freeze([
  { id: 'peace-chaos', text: 'Pick the contract energy for tonight.', options: ['Protect the peace', 'Choose chaos'] },
  { id: 'last-word', text: 'Only one of you gets the last word. Who takes it?', options: ['Me', 'Them'] },
  { id: 'reset-receipts', text: 'You can settle one thing without explaining. What do you choose?', options: ['Drop the grudge', 'Keep receipts'] },
  { id: 'tomorrow-rule', text: 'Choose tomorrow’s one unwritten rule.', options: ['No disappearing', 'No dry replies'] },
  { id: 'soft-hard', text: 'How should this contract handle the next weird moment?', options: ['Soft reset', 'Call it out'] },
  { id: 'protect-push', text: 'If the vibe gets tense, what should win?', options: ['Protect the duo', 'Push the issue'] },
  { id: 'say-wait', text: 'Something feels off. What is the move?', options: ['Say it now', 'Wait and watch'] },
  { id: 'forgive-receipt', text: 'One tiny offense happens tonight. What survives?', options: ['Instant forgiveness', 'The receipt'] }
]);

const DOUBLE_DARES = Object.freeze([
  'Use your next tiny note to roast me.',
  'Send a 10-second voice check-in with zero context.',
  'Say one thing you almost kept to yourself.',
  'Give me one painfully specific compliment.',
  'Admit the pettiest thing you noticed this week.',
  'Make your next check-in status “chaos.”',
  'Send the most unserious voice check-in you can.',
  'Tell me one thing I do that is annoyingly predictable.'
]);

const idString = (value) => String(value?._id || value || '');

const partnerIdFor = (friendship, userId) => (
  idString(friendship.user1) === idString(userId) ? friendship.user2 : friendship.user1
);

const partnerNameFor = (friendship, userId) => (
  idString(friendship.user1) === idString(userId)
    ? friendship.user2DisplayName || 'your partner'
    : friendship.user1DisplayName || 'your partner'
);

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
const sampleItems = (items, count) => [...items]
  .map((value) => ({ value, sort: Math.random() }))
  .sort((a, b) => a.sort - b.sort)
  .slice(0, count)
  .map((item) => item.value);

const chooseHotSeatPrompt = async (friendshipId, season) => {
  const [contractRecent, globalRecent] = await Promise.all([
    ContractMoment.find({
      friendshipId,
      type: 'HOT_SEAT',
      'metadata.season': season
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('promptId')
      .lean(),
    ContractMoment.find({ type: 'HOT_SEAT' })
      .sort({ createdAt: -1 })
      .limit(16)
      .select('promptId')
      .lean()
  ]);

  const contractIds = new Set(contractRecent.map((item) => item.promptId).filter(Boolean));
  const globalIds = new Set(globalRecent.slice(0, 6).map((item) => item.promptId).filter(Boolean));

  let candidates = HOT_SEAT_PROMPTS.filter((item) => !contractIds.has(item.id) && !globalIds.has(item.id));
  if (!candidates.length) candidates = HOT_SEAT_PROMPTS.filter((item) => !contractIds.has(item.id));
  if (!candidates.length) candidates = HOT_SEAT_PROMPTS;

  return randomItem(candidates);
};

const recordMomentEvent = (friendshipId, type, userId, metadata = {}) => ContractEvent.create({
  friendshipId,
  userId: userId || null,
  type,
  metadata
});

const typeLabel = (type) => {
  if (type === 'SPLIT_DECISION') return 'Split Decision';
  if (type === 'DOUBLE_DARE') return 'Double Dare';
  return 'Hot Seat';
};

const eventPrefix = (type) => type;

const openNotificationCopy = (type) => {
  if (type === 'SPLIT_DECISION') {
    return {
      title: 'Split Decision is open',
      message: 'Pick your side. Their answer stays hidden until both choices are locked.'
    };
  }
  return {
    title: 'Hot Seat is open',
    message: 'No peeking. Lock your answer before the other person does.'
  };
};

const refreshMoment = async (moment, now = new Date()) => {
  if (!moment) return null;
  let current = moment;

  if (current.status === 'BREWING' && new Date(current.unlockAt) <= now) {
    const opened = await ContractMoment.findOneAndUpdate(
      { _id: current._id, status: 'BREWING', unlockAt: { $lte: now } },
      { $set: { status: 'OPEN' } },
      { new: true }
    );

    if (opened) {
      current = opened;
      const friendship = await Friendship.findById(current.friendshipId)
        .select('user1 user2 status')
        .lean();
      const prefix = eventPrefix(current.type);
      const copy = openNotificationCopy(current.type);
      const writes = [
        recordMomentEvent(current.friendshipId, `${prefix}_OPENED`, null, {
          momentId: String(current._id),
          promptId: current.promptId,
          expiresAt: current.expiresAt
        }).catch(() => null)
      ];

      if (friendship?.status === 'ACTIVE') {
        writes.push(
          Notification.create({
            toUserId: friendship.user1,
            type: `${prefix}_OPENED`,
            title: copy.title,
            message: copy.message,
            friendshipId: current.friendshipId
          }).catch(() => null),
          Notification.create({
            toUserId: friendship.user2,
            type: `${prefix}_OPENED`,
            title: copy.title,
            message: copy.message,
            friendshipId: current.friendshipId
          }).catch(() => null)
        );
      }

      await Promise.all(writes);
    } else {
      current = await ContractMoment.findById(current._id);
      if (!current) return null;
    }
  }

  if (current.status === 'OPEN' && new Date(current.expiresAt) <= now) {
    const expired = await ContractMoment.findOneAndUpdate(
      { _id: current._id, status: 'OPEN', expiresAt: { $lte: now } },
      { $set: { status: 'EXPIRED' } },
      { new: true }
    );

    if (expired) {
      current = expired;
      await recordMomentEvent(current.friendshipId, `${eventPrefix(current.type)}_EXPIRED`, null, {
        momentId: String(current._id)
      }).catch(() => null);
    } else {
      current = await ContractMoment.findById(current._id);
    }
  }

  return current;
};

const nextMomentType = async (friendshipId, season) => {
  const latest = await ContractMoment.findOne({
    friendshipId,
    'metadata.season': season
  }).sort({ createdAt: -1 }).select('type').lean();
  if (!latest?.type) return MOMENT_ORDER[0];
  const index = MOMENT_ORDER.indexOf(latest.type);
  return MOMENT_ORDER[(index + 1 + MOMENT_ORDER.length) % MOMENT_ORDER.length];
};

const createMutualMenaceMoment = async (friendship, startedByUserId, now = new Date()) => {
  const season = Number(friendship.season?.number) || 1;
  const active = await ContractMoment.findOne({
    friendshipId: friendship._id,
    status: { $in: ['BREWING', 'OPEN'] },
    'metadata.season': season
  }).sort({ createdAt: -1 });

  if (active) return refreshMoment(active, now);

  const type = await nextMomentType(friendship._id, season);

  if (type === 'DOUBLE_DARE') {
    const expiresAt = new Date(now.getTime() + MOMENT_OPEN_MS);
    const moment = await ContractMoment.create({
      friendshipId: friendship._id,
      type,
      status: 'OPEN',
      startedByUserId: startedByUserId || null,
      promptId: 'double-dare',
      promptText: 'Pick one to send.',
      options: sampleItems(DOUBLE_DARES, 3),
      responses: [],
      unlockAt: now,
      expiresAt,
      metadata: { trigger: 'MUTUAL_POKE', season, stage: 'PICKING' }
    });

    await recordMomentEvent(friendship._id, 'DOUBLE_DARE_STARTED', startedByUserId, {
      momentId: String(moment._id),
      expiresAt
    }).catch(() => null);

    return moment;
  }

  const prompt = type === 'SPLIT_DECISION'
    ? randomItem(SPLIT_DECISION_PROMPTS)
    : await chooseHotSeatPrompt(friendship._id, season);
  const brewMinutes = type === 'SPLIT_DECISION'
    ? 8 + Math.floor(Math.random() * 13)
    : 15 + Math.floor(Math.random() * 21);
  const unlockAt = new Date(now.getTime() + brewMinutes * MINUTE);
  const expiresAt = new Date(unlockAt.getTime() + MOMENT_OPEN_MS);

  const moment = await ContractMoment.create({
    friendshipId: friendship._id,
    type,
    status: 'BREWING',
    startedByUserId: startedByUserId || null,
    promptId: prompt.id,
    promptText: prompt.text,
    options: prompt.options,
    responses: [],
    unlockAt,
    expiresAt,
    metadata: { trigger: 'MUTUAL_POKE', season }
  });

  await recordMomentEvent(friendship._id, `${eventPrefix(type)}_BREWING`, startedByUserId, {
    momentId: String(moment._id),
    unlockAt,
    expiresAt
  }).catch(() => null);

  return moment;
};

const sharedHiddenAnswerView = (moment, base, ownResponse, partnerResponse) => {
  const label = typeLabel(moment.type);
  if (moment.status === 'BREWING') {
    return { ...base, label: `${label} brewing` };
  }

  if (moment.status === 'OPEN') {
    return {
      ...base,
      label,
      prompt: moment.promptText,
      options: moment.options || [],
      answered: Boolean(ownResponse),
      yourAnswer: ownResponse?.value || null,
      partnerAnswered: Boolean(partnerResponse)
    };
  }

  if (moment.status === 'RESOLVED') {
    return {
      ...base,
      label: `${label} revealed`,
      prompt: moment.promptText,
      yourAnswer: ownResponse?.value || null,
      partnerAnswer: partnerResponse?.value || null,
      matched: moment.type === 'SPLIT_DECISION'
        ? Boolean(ownResponse?.value && ownResponse.value === partnerResponse?.value)
        : null
    };
  }

  return null;
};

const doubleDareView = (moment, friendship, userId, base) => {
  const viewerId = idString(userId);
  const starterId = idString(moment.startedByUserId);
  const isStarter = viewerId === starterId;
  const starterResponse = (moment.responses || []).find((item) => idString(item.userId) === starterId);
  const otherResponse = (moment.responses || []).find((item) => idString(item.userId) !== starterId);
  const partnerName = partnerNameFor(friendship, userId);

  if (moment.status === 'OPEN') {
    if (!starterResponse) {
      return {
        ...base,
        label: 'Double Dare',
        phase: isStarter ? 'PICK' : 'WAITING',
        prompt: isStarter ? 'Pick one to send.' : `${partnerName} is choosing your dare.`,
        options: isStarter ? moment.options || [] : []
      };
    }

    return {
      ...base,
      label: 'Double Dare',
      phase: isStarter ? 'WAITING' : 'RESPOND',
      prompt: isStarter ? `Dare sent to ${partnerName}.` : `${partnerName} dared you:`,
      dare: starterResponse.value,
      options: isStarter ? [] : ['Accept', 'Pass']
    };
  }

  if (moment.status === 'RESOLVED') {
    return {
      ...base,
      label: 'Double Dare resolved',
      phase: 'RESOLVED',
      dare: starterResponse?.value || null,
      outcome: otherResponse?.value || null,
      startedByYou: isStarter
    };
  }

  return null;
};

const momentView = (moment, friendship, userId) => {
  if (!moment) return null;
  const viewerId = idString(userId);
  const partnerId = idString(partnerIdFor(friendship, userId));
  const ownResponse = (moment.responses || []).find((item) => idString(item.userId) === viewerId);
  const partnerResponse = (moment.responses || []).find((item) => idString(item.userId) === partnerId);
  const base = {
    id: idString(moment._id),
    type: moment.type,
    status: moment.status,
    unlockAt: moment.unlockAt,
    expiresAt: moment.expiresAt,
    resolvedAt: moment.resolvedAt || null,
    partnerName: partnerNameFor(friendship, userId)
  };

  if (moment.type === 'DOUBLE_DARE') {
    return doubleDareView(moment, friendship, userId, base);
  }

  return sharedHiddenAnswerView(moment, base, ownResponse, partnerResponse);
};

const getMomentViews = async (userId, friendships) => {
  if (!friendships?.length) return {};
  const friendshipIds = friendships.map((item) => item._id);
  const now = new Date();

  const moments = await ContractMoment.find({
    friendshipId: { $in: friendshipIds },
    $or: [
      { status: { $in: ['BREWING', 'OPEN'] } },
      { status: 'RESOLVED', resolvedAt: { $gte: new Date(now.getTime() - RESOLVED_VISIBLE_MS) } }
    ]
  }).sort({ createdAt: -1 });

  const refreshedMoments = (await Promise.all(moments.map((moment) => refreshMoment(moment, now)))).filter(Boolean);
  const friendshipById = new Map(friendships.map((item) => [idString(item._id), item]));
  const views = {};

  for (const moment of refreshedMoments) {
    if (moment.status === 'EXPIRED') continue;
    const friendshipId = idString(moment.friendshipId);
    if (views[friendshipId]) continue;
    const friendship = friendshipById.get(friendshipId);
    if (!friendship) continue;
    const momentSeason = Number(moment.metadata?.season) || 1;
    const currentSeason = Number(friendship.season?.number) || 1;
    if (momentSeason !== currentSeason) continue;
    views[friendshipId] = momentView(moment, friendship, userId);
  }

  return views;
};

const resolveSharedMoment = async (moment, friendship, userId, answer) => {
  if (!(moment.options || []).includes(answer)) {
    const error = new Error(`Choose one of the ${typeLabel(moment.type)} answers`);
    error.status = 400;
    throw error;
  }

  const answeredAt = new Date();
  const updated = await ContractMoment.findOneAndUpdate(
    {
      _id: moment._id,
      status: 'OPEN',
      'responses.userId': { $ne: userId }
    },
    {
      $push: { responses: { userId, value: answer, answeredAt } }
    },
    { new: true }
  );

  if (!updated) {
    const error = new Error('Your answer is already locked');
    error.status = 409;
    throw error;
  }

  moment = updated;
  const partnerId = partnerIdFor(friendship, userId);
  const actor = await User.findById(userId).select('displayName');
  const prefix = eventPrefix(moment.type);
  const label = typeLabel(moment.type);

  if (moment.responses.length >= 2) {
    const resolvedAt = new Date();
    const resolved = await ContractMoment.findOneAndUpdate(
      {
        _id: moment._id,
        status: 'OPEN',
        'responses.1': { $exists: true }
      },
      { $set: { status: 'RESOLVED', resolvedAt } },
      { new: true }
    );

    moment = resolved || await ContractMoment.findById(moment._id);
    if (resolved) {
      await Promise.all([
        recordMomentEvent(friendship._id, `${prefix}_REVEALED`, userId, {
          momentId: String(moment._id),
          promptId: moment.promptId
        }).catch(() => null),
        Notification.create({
          toUserId: partnerId,
          fromUserId: userId,
          type: `${prefix}_REVEALED`,
          title: `${label} revealed`,
          message: 'Both choices are in. Go see the reveal.',
          friendshipId: friendship._id
        }).catch(() => null)
      ]);
    }
  } else {
    await Promise.all([
      recordMomentEvent(friendship._id, `${prefix}_ANSWERED`, userId, {
        momentId: String(moment._id)
      }).catch(() => null),
      Notification.create({
        toUserId: partnerId,
        fromUserId: userId,
        type: `${prefix}_ANSWERED`,
        title: 'Your turn',
        message: `${actor?.displayName || 'Your partner'} answered ${label}. Their choice stays hidden until you answer.`,
        friendshipId: friendship._id
      }).catch(() => null)
    ]);
  }

  return momentView(moment, friendship, userId);
};

const resolveDoubleDare = async (moment, friendship, userId, answer) => {
  const viewerId = idString(userId);
  const starterId = idString(moment.startedByUserId);
  const isStarter = viewerId === starterId;
  const starterResponse = (moment.responses || []).find((item) => idString(item.userId) === starterId);
  const partnerId = partnerIdFor(friendship, userId);
  const actor = await User.findById(userId).select('displayName');

  if (!starterResponse) {
    if (!isStarter) {
      const error = new Error('They are still choosing your dare');
      error.status = 409;
      throw error;
    }
    if (!(moment.options || []).includes(answer)) {
      const error = new Error('Choose one of the dares');
      error.status = 400;
      throw error;
    }

    const updated = await ContractMoment.findOneAndUpdate(
      {
        _id: moment._id,
        status: 'OPEN',
        startedByUserId: userId,
        'responses.userId': { $ne: userId }
      },
      {
        $push: { responses: { userId, value: answer, answeredAt: new Date() } },
        $set: {
          'metadata.stage': 'SENT',
          'metadata.dare': answer
        }
      },
      { new: true }
    );

    if (!updated) {
      const error = new Error('You already sent this dare');
      error.status = 409;
      throw error;
    }

    moment = updated;
    await Promise.all([
      recordMomentEvent(friendship._id, 'DOUBLE_DARE_SENT', userId, {
        momentId: String(moment._id),
        dare: answer
      }).catch(() => null),
      Notification.create({
        toUserId: partnerId,
        fromUserId: userId,
        type: 'DOUBLE_DARE_SENT',
        title: 'Double Dare',
        message: `${actor?.displayName || 'Your partner'} sent you a dare. Accept it or pass.`,
        friendshipId: friendship._id
      }).catch(() => null)
    ]);

    return momentView(moment, friendship, userId);
  }

  if (isStarter) {
    const error = new Error('Waiting on your partner');
    error.status = 409;
    throw error;
  }

  if (!['Accept', 'Pass'].includes(answer)) {
    const error = new Error('Accept the dare or pass');
    error.status = 400;
    throw error;
  }

  const resolvedAt = new Date();
  const resolved = await ContractMoment.findOneAndUpdate(
    {
      _id: moment._id,
      status: 'OPEN',
      $and: [
        { 'responses.userId': moment.startedByUserId },
        { 'responses.userId': { $ne: userId } }
      ]
    },
    {
      $push: { responses: { userId, value: answer, answeredAt: resolvedAt } },
      $set: {
        status: 'RESOLVED',
        resolvedAt,
        'metadata.stage': 'RESOLVED',
        'metadata.outcome': answer
      }
    },
    { new: true }
  );

  if (!resolved) {
    const error = new Error('This dare already moved on');
    error.status = 409;
    throw error;
  }

  moment = resolved;
  const starterUserId = moment.startedByUserId;
  await Promise.all([
    recordMomentEvent(friendship._id, 'DOUBLE_DARE_REVEALED', userId, {
      momentId: String(moment._id),
      outcome: answer
    }).catch(() => null),
    Notification.create({
      toUserId: starterUserId,
      fromUserId: userId,
      type: 'DOUBLE_DARE_REVEALED',
      title: answer === 'Accept' ? 'Dare accepted' : 'Dare passed',
      message: `${actor?.displayName || 'Your partner'} ${answer === 'Accept' ? 'accepted' : 'passed on'} your Double Dare.`,
      friendshipId: friendship._id
    }).catch(() => null)
  ]);

  return momentView(moment, friendship, userId);
};

const respondToMoment = async (friendship, userId, momentId, value) => {
  let moment = await ContractMoment.findOne({ _id: momentId, friendshipId: friendship._id });
  if (!moment) {
    const error = new Error('That moment is gone');
    error.status = 404;
    throw error;
  }

  moment = await refreshMoment(moment);
  if (!moment || moment.status !== 'OPEN') {
    const error = new Error(moment?.status === 'BREWING' ? `${typeLabel(moment.type)} is still brewing` : 'That moment is closed');
    error.status = 409;
    throw error;
  }

  const viewerId = idString(userId);
  const participantIds = [idString(friendship.user1), idString(friendship.user2)];
  if (!participantIds.includes(viewerId)) {
    const error = new Error('Not authorized');
    error.status = 403;
    throw error;
  }

  const answer = String(value || '').trim();
  if (moment.type === 'DOUBLE_DARE') {
    return resolveDoubleDare(moment, friendship, userId, answer);
  }

  return resolveSharedMoment(moment, friendship, userId, answer);
};

module.exports = {
  HOT_SEAT_PROMPTS,
  SPLIT_DECISION_PROMPTS,
  DOUBLE_DARES,
  createMutualMenaceMoment,
  getMomentViews,
  respondToMoment,
  refreshMoment
};
