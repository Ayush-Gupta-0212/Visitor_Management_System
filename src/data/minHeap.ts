/**
 * A binary min-heap (priority queue) keyed by a numeric timestamp.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two rules in the spec are time-driven: an approved visitor who never arrives
 * must EXPIRE, and a checked-in visitor who stays past their window must be
 * flagged OVERSTAY. The obvious implementation is a `setInterval` that scans
 * every visit each tick - O(N) per second, which at N = 50,000 burns the main
 * thread forever and gets worse as the business grows.
 *
 * Instead we keep the pending deadlines in a min-heap ordered by the time they
 * fire. Each tick only has to look at the head:
 *
 *   peek   O(1)       "is the earliest deadline due yet?"  - almost always no
 *   push   O(log N)
 *   pop    O(log N)
 *
 * So a tick costs O(1) when nothing is due, and O(d log N) when d deadlines are,
 * independent of how many visits exist. That is the difference between an app
 * that degrades with dataset size and one that does not.
 */
export interface HeapNode<T> {
  /** Sort key: the epoch-millisecond time at which this entry becomes due. */
  at: number;
  value: T;
}

export class MinHeap<T> {
  private nodes: HeapNode<T>[] = [];

  get size(): number {
    return this.nodes.length;
  }

  /** The earliest-due entry, without removing it. O(1). */
  peek(): HeapNode<T> | undefined {
    return this.nodes[0];
  }

  /** O(log n) - sift the new node up until its parent is no later than it. */
  push(at: number, value: T): void {
    this.nodes.push({ at, value });
    let i = this.nodes.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.nodes[parent].at <= this.nodes[i].at) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  /** O(log n) - move the last node to the root and sift it down. */
  pop(): HeapNode<T> | undefined {
    if (this.nodes.length === 0) return undefined;
    const top = this.nodes[0];
    const last = this.nodes.pop()!;
    if (this.nodes.length > 0) {
      this.nodes[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  /** Removes and returns every entry due at or before `now`. */
  drainDueBy(now: number): T[] {
    const due: T[] = [];
    while (this.nodes.length > 0 && this.nodes[0].at <= now) {
      due.push(this.pop()!.value);
    }
    return due;
  }

  clear(): void {
    this.nodes = [];
  }

  private siftDown(start: number): void {
    const n = this.nodes.length;
    let i = start;
    for (;;) {
      const left = i * 2 + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this.nodes[left].at < this.nodes[smallest].at) smallest = left;
      if (right < n && this.nodes[right].at < this.nodes[smallest].at) smallest = right;
      if (smallest === i) return;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const tmp = this.nodes[a];
    this.nodes[a] = this.nodes[b];
    this.nodes[b] = tmp;
  }
}
