interface Feature<Data = unknown, Item = Data> {
  write(data: Data, item: Item): any;
  read(data: Data): Item;
}

type Features = { [key: string]: Feature };

interface Dataset<Data, Item> {
  data: Data[];
  length: number;
  features: Features;

  getData(index: number): Data;
  getItem(index: number): Item;

  addItem(item: Item, data: Data): void;

  select(indices: number[]): Dataset<Data, Item>;
  shuffle(seed?: number): Dataset<Data, Item>;
  map(fn: (item: Data) => Data): Dataset<Data, Item>;
  filter(fn: (item: Data) => boolean): Dataset<Data, Item>;
}

export class InMemoryDataset<Data = unknown, Item = Data>
  implements Dataset<Data, Item>
{
  data: Data[];

  constructor({ data, features }: { data: Data[]; features: Features }) {
    this.data = [...data];
    this.length = data.length;
    this.features = { ...features };
  }

  length: number;
  features: Features;

  getData(index: number): Data {
    return this.data[index];
  }

  getItem(index: number): Item {
    const item_data = this.data[index];
    return Object.entries(this.features).reduce((acc, [key, feature]) => {
      acc[key] = feature.read(item_data);
      return acc;
    }, {} as Item) as Item;
  }

  addItem(item: Item, data: Data): void {
    for (const [key, feature] of Object.entries(this.features)) {
      feature.write(data[key], item[key]);
    }

    this.data.push(data);
  }

  select(indices: number[]): InMemoryDataset<Data, Item> {
    return new InMemoryDataset<Data, Item>({
      data: indices.map((i) => this.data[i]),
      features: this.features,
    });
  }

  shuffle(seed?: number): InMemoryDataset<Data, Item> {
    return new InMemoryDataset<Data, Item>({
      data: seededShuffle(
        this.data,
        seed ?? Math.floor(Math.random() * 2 * 32)
      ),
      features: this.features,
    });
  }

  map<U>(fn: (item: Data) => U): InMemoryDataset<U, Item> {
    return new InMemoryDataset<U, Item>({
      data: this.data.map(fn),
      features: this.features,
    });
  }

  filter(fn: (item: Data) => boolean): InMemoryDataset<Data, Item> {
    return new InMemoryDataset<Data, Item>({
      data: this.data.filter(fn),
      features: this.features,
    });
  }
}

export class ConcatenatedDataset<Data = unknown, Item = Data>
  implements Dataset<Data, Item>
{
  constructor({ datasets }: { datasets: Dataset<Data, Item>[] }) {
    this.datasets = datasets;
    this.filepath = "N/A";
  }

  datasets: Dataset<Data, Item>[];

  filepath: string;

  get length() {
    return this.datasets.reduce((acc, cur) => acc + cur.length, 0);
  }

  get features() {
    return this.datasets[0].features;
  }

  get data() {
    return this.datasets.reduce(
      (acc, cur) => [...acc, ...cur.data],
      [] as Data[]
    );
  }

  addItem(item: Item): void {
    throw new Error("ConcatenatedDataset does not support addItem");
  }

  getData(index: number): Data {
    let offset = index;
    for (const dataset of this.datasets) {
      if (offset < dataset.length) {
        return dataset.getData(offset);
      }
      offset -= dataset.length;
    }
    throw new Error("Index out of bounds");
  }

  getItem(index: number): Item {
    let offset = index;
    for (const dataset of this.datasets) {
      if (offset < dataset.length) {
        return dataset.getItem(offset);
      }
      offset -= dataset.length;
    }
    throw new Error("Index out of bounds");
  }

  select(indices: number[]): InMemoryDataset<Data, Item> {
    const data = indices.map((i) => this.getData(i));
    return new InMemoryDataset<Data, Item>({
      data,
      features: this.features,
    });
  }

  shuffle(seed?: number): ConcatenatedDataset<Data, Item> {
    return new ConcatenatedDataset<Data, Item>({
      datasets: this.datasets.map((dataset) => dataset.shuffle(seed)),
    });
  }

  map(fn: (item: Data) => Data): ConcatenatedDataset<Data, Item> {
    return new ConcatenatedDataset<Data, Item>({
      datasets: this.datasets.map((dataset) => dataset.map(fn)),
    });
  }

  filter(fn: (item: Data) => boolean): ConcatenatedDataset<Data, Item> {
    return new ConcatenatedDataset<Data, Item>({
      datasets: this.datasets.map((dataset) => dataset.filter(fn)),
    });
  }
}
