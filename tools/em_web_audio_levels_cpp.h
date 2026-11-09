/* Inserted into the prepared, unpinned YM adapter only. This is the original
 * YM2612 generate loop with a read-only copy of its per-channel contributions.
 * The raw aggregate, original operator feedback updates and all clocks remain
 * identical. Extra output history is deliberately absent from chip save state. */
class DuneOutputYM2612 final : public ymfm::ym2612 {
public:
    unsigned levels[6]={100,100,100,100,100,100};
    int common_level=100;
    int32_t previous_parts[6][2]{},current_parts[6][2]{};
    unsigned parts_ready=0;
    DuneOutputYM2612(ymfm::ymfm_interface &intf) : ymfm::ym2612(intf) {}
    bool unity() const { return common_level==100; }
    void reset() { ymfm::ym2612::reset();parts_ready=0; }
    void generate(output_data *output,uint32_t numsamples=1) {
        if(common_level>=0){parts_ready=0;ymfm::ym2612::generate(output,numsamples);return;}
        for(uint32_t samp=0;samp<numsamples;++samp,++output){
            std::memcpy(previous_parts,current_parts,sizeof current_parts);
            std::memset(current_parts,0,sizeof current_parts);
            m_fm.clock(fm_engine::ALL_CHANNELS);
            output->clear();output_data temp;
            int const last_fm_channel=m_dac_enable?5:6;
            for(int chan=0;chan<last_fm_channel;++chan){
                m_fm.output(temp.clear(),5,256,1<<chan);
                for(unsigned side=0;side<2;++side)
                    output->data[side]+=current_parts[chan][side]=dac_discontinuity(temp.data[side]);
            }
            if(m_dac_enable){
                int32_t dacval=dac_discontinuity(int16_t(m_dac_data<<7)>>7);
                current_parts[5][0]=m_fm.regs().ch_output_0(0x102)?dacval:dac_discontinuity(0);
                current_parts[5][1]=m_fm.regs().ch_output_1(0x102)?dacval:dac_discontinuity(0);
                output->data[0]+=current_parts[5][0];output->data[1]+=current_parts[5][1];
            }
            output->data[0]=(output->data[0]*128)*64/(6*65);
            output->data[1]=(output->data[1]*128)*64/(6*65);
            if(parts_ready<2)++parts_ready;
        }
    }
    int32_t level_output(unsigned side,unsigned fraction,int32_t raw) const {
        if(common_level>=0)return common_level==100?raw:int32_t(int64_t(raw)*common_level/100);
        // A restored original state contains only its raw mixed interpolation
        // history. Warm two FM samples (at most ~38us), without replaying or
        // clocking the chip twice, before using split presentation history.
        if(parts_ready<2)return raw;
        int64_t before=0,after=0;
        for(unsigned c=0;c<6;++c){before+=int64_t(previous_parts[c][side])*levels[c];after+=int64_t(current_parts[c][side])*levels[c];}
        int32_t prev=int32_t(before*128*64/(6*65*100)),cur=int32_t(after*128*64/(6*65*100));
        return prev+int32_t((int64_t(cur)-prev)*fraction/144);
    }
};
