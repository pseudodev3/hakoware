export const sparkFailure = error => {
  const paused = [503, 507].includes(Number(error?.status));
  return paused ? {
    paused: true,
    title: 'Sparks is taking a pause.',
    message: 'Sharing is temporarily unavailable. Your conversations and Duos are still open.'
  } : {
    paused: false,
    title: 'Your Sparks couldn’t load.',
    message: 'We couldn’t reach your circle’s moments. Try again when you’re ready.'
  };
};
