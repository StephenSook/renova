/**
 * The sample packets.
 *
 * Every image is synthetic and watermarked: the states' real formats with
 * invented values. The New York pair is first because New York is the state
 * whose deadline lives on the cover notice rather than the form, which is the
 * exact failure this product was built around.
 */
export interface DemoScenario {
  id: 'ny-pair' | 'ca-mc216' | 'adversarial';
  label: string;
  description: string;
  images: string[];
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'ny-pair',
    label: 'New York: the form and the notice that came with it',
    description: 'The deadline is on the notice, not the form.',
    images: ['/demo/ny-01-form.png', '/demo/ny-02-notice.png'],
  },
  {
    id: 'ca-mc216',
    label: 'California: MC 216 renewal form',
    description: 'The deadline is printed on the form itself.',
    images: ['/demo/ca-01-mc216.png'],
  },
  {
    id: 'adversarial',
    label: 'A page that tries to trick the reader',
    description: 'Printed instructions tell tools to change the deadline. They are not obeyed.',
    images: ['/demo/adversarial-injection.png'],
  },
];
