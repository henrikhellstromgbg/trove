'use client';

import { AspectRatio as AspectRatioPrimitive } from 'radix-ui';

function AspectRatio(props: React.ComponentProps<typeof AspectRatioPrimitive.Root>) {
  return <AspectRatioPrimitive.Root {...props} />;
}

export { AspectRatio };
