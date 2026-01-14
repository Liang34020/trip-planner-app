from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List
from app.core.config import settings


def calculate_new_sequence(
    prev_sequence: Optional[Decimal],
    next_sequence: Optional[Decimal]
) -> Decimal:
    """
    計算新的 sequence 值 (Fractional Indexing)
    
    Args:
        prev_sequence: 前一個項目的 sequence (None 表示插入到最前)
        next_sequence: 後一個項目的 sequence (None 表示插入到最後)
    
    Returns:
        新的 sequence 值
    
    Examples:
        >>> calculate_new_sequence(None, Decimal('1.0'))
        Decimal('0.5')
        
        >>> calculate_new_sequence(Decimal('1.0'), Decimal('2.0'))
        Decimal('1.5')
        
        >>> calculate_new_sequence(Decimal('5.0'), None)
        Decimal('6.0')
    """
    
    # 情況 1: 插入到最前面
    if prev_sequence is None and next_sequence is None:
        return Decimal('1.0')
    
    if prev_sequence is None:
        # 在第一個項目之前插入
        return next_sequence / 2
    
    # 情況 2: 插入到最後面
    if next_sequence is None:
        return prev_sequence + Decimal('1.0')
    
    # 情況 3: 插入到中間
    new_seq = (prev_sequence + next_sequence) / 2
    
    # 四捨五入到指定精度
    return new_seq.quantize(
        Decimal('0.0000000001'),  # 10 位小數
        rounding=ROUND_HALF_UP
    )


def needs_rebalancing(sequences: List[Decimal]) -> bool:
    """
    檢查是否需要重新平衡序號
    
    當相鄰項目的 sequence 差距小於閾值時,需要重新分配
    
    Args:
        sequences: 已排序的 sequence 列表
    
    Returns:
        是否需要重新平衡
    """
    if len(sequences) < 2:
        return False
    
    threshold = Decimal(str(settings.SEQUENCE_REBALANCE_THRESHOLD))
    
    for i in range(len(sequences) - 1):
        diff = sequences[i + 1] - sequences[i]
        if diff < threshold:
            return True
    
    return False


def rebalance_sequences(count: int) -> List[Decimal]:
    """
    重新生成均勻分佈的 sequence 序列
    
    Args:
        count: 項目數量
    
    Returns:
        新的 sequence 列表 [1.0, 2.0, 3.0, ...]
    
    Example:
        >>> rebalance_sequences(5)
        [Decimal('1.0'), Decimal('2.0'), Decimal('3.0'), Decimal('4.0'), Decimal('5.0')]
    """
    return [Decimal(str(i + 1)) for i in range(count)]


def get_sequence_for_position(
    existing_sequences: List[Decimal],
    target_position: int
) -> Decimal:
    """
    根據目標位置計算新的 sequence
    
    Args:
        existing_sequences: 當前已排序的 sequence 列表
        target_position: 目標位置 (0-based index)
    
    Returns:
        新的 sequence 值
    
    Example:
        >>> get_sequence_for_position([Decimal('1.0'), Decimal('3.0')], 1)
        Decimal('2.0')  # 插入到中間
    """
    if not existing_sequences:
        return Decimal('1.0')
    
    # 插入到最前面
    if target_position <= 0:
        return calculate_new_sequence(None, existing_sequences[0])
    
    # 插入到最後面
    if target_position >= len(existing_sequences):
        return calculate_new_sequence(existing_sequences[-1], None)
    
    # 插入到中間
    prev_seq = existing_sequences[target_position - 1]
    next_seq = existing_sequences[target_position]
    
    return calculate_new_sequence(prev_seq, next_seq)


# 測試函數
if __name__ == "__main__":
    # 測試基本功能
    print("測試 1: 插入到空列表")
    seq1 = calculate_new_sequence(None, None)
    print(f"結果: {seq1}")  # 1.0
    
    print("\n測試 2: 插入到最前面")
    seq2 = calculate_new_sequence(None, Decimal('1.0'))
    print(f"結果: {seq2}")  # 0.5
    
    print("\n測試 3: 插入到中間")
    seq3 = calculate_new_sequence(Decimal('1.0'), Decimal('2.0'))
    print(f"結果: {seq3}")  # 1.5
    
    print("\n測試 4: 插入到最後")
    seq4 = calculate_new_sequence(Decimal('5.0'), None)
    print(f"結果: {seq4}")  # 6.0
    
    print("\n測試 5: 檢查是否需要重新平衡")
    sequences = [Decimal('1.0'), Decimal('1.0000000001'), Decimal('3.0')]
    needs_rebalance = needs_rebalancing(sequences)
    print(f"需要重新平衡: {needs_rebalance}")  # True
    
    print("\n測試 6: 重新平衡")
    new_sequences = rebalance_sequences(5)
    print(f"新序列: {new_sequences}")  # [1.0, 2.0, 3.0, 4.0, 5.0]