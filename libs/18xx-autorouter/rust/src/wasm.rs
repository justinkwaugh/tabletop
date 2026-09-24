#[unsafe(no_mangle)]
pub extern "C" fn allocate(length: usize) -> *mut u8 {
    Box::into_raw(vec![0u8; length].into_boxed_slice()) as *mut u8
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn release(pointer: *mut u8, length: usize) {
    drop(unsafe { Box::from_raw(std::ptr::slice_from_raw_parts_mut(pointer, length)) });
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solve(pointer: *const u8, length: usize) -> u64 {
    let output = super::solve_json(unsafe { std::slice::from_raw_parts(pointer, length) })
        .into_boxed_slice();
    let length = output.len();
    let pointer = Box::into_raw(output) as *mut u8;
    ((length as u64) << 32) | pointer as u64
}
