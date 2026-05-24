class ListIterator {
public:
    ListIterator& operator++() { ++index_; return *this; }
    int operator*() const { return data_[index_]; }
    bool operator!=(const ListIterator& o) const { return index_ != o.index_; }
private:
    int* data_ = nullptr;
    int index_ = 0;
};
